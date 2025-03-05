const COLLECTION_SPREADSHEET_ID = "1NMEnhN9DqrkKItMFw3TPW5_njPTb3CtqV15gsE3_058"
const MOCK_DATA = "19UbnoiMrottTM3PsoORPRe3BypkdkHlYuU9KS9ovav8"

function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle("CHEDeTeX")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function searchTheses(query = '', yearFilter = 'anytime', page = 1, pageSize = 10, selectedTags = []) {
  const results = [];
  const uniqueIds = new Set();

  try {
    const searchQuery = String(query || '').toLowerCase();
    const collectionSpreadsheet = SpreadsheetApp.openById(COLLECTION_SPREADSHEET_ID)
    const mainSheet = collectionSpreadsheet.getSheetByName('Main')
    const mainData = mainSheet.getDataRange().getValues();

    // Determine which years to include based on yearFilter
    let includeYearFn;

    if (yearFilter === 'anytime') {
      includeYearFn = (year) => true;
    } else if (typeof yearFilter === 'object' && yearFilter.type === 'custom') {
      // Custom year range
      includeYearFn = (year) => {
        const numYear = Number(year);
        return numYear >= yearFilter.startYear && numYear <= yearFilter.endYear;
      };
    } else {
      const filterYear = Number(yearFilter);
      includeYearFn = (year) => {
        const numYear = Number(year);
        return numYear === filterYear;
      };
    }

    const selectedTagsSet = new Set(selectedTags);

    for (let i = 1; i < mainData.length; i++) {
      const [year, ssId] = mainData[i];

      if (!includeYearFn(year)) {
        continue;
      }

      if (!ssId || typeof ssId !== 'string' || ssId.trim() === '') {
        continue;
      }

      try {
        const yearSpreadsheet = SpreadsheetApp.openById(ssId);
        const yearSheet = yearSpreadsheet.getActiveSheet();
        const yearData = yearSheet.getDataRange().getValues();

        for (let j = 1; j < yearData.length; j++) {
          const row = yearData[j];
          if (row.length < 8) continue;

          const [rowYear, month, school, author, title, folderId, tag, rowTimestamp] = row;

          if (!includeYearFn(rowYear)) continue;
          if (uniqueIds.has(folderId)) continue;
          uniqueIds.add(folderId);

          const searchableValues = [
            String(month || ''),
            String(school || ''),
            String(author || ''),
            String(title || ''),
            String(tag || '')
          ].map(val => val.toLowerCase());

          const rowTags = tag ? String(tag).split('|').map(t => t.trim()) : [];

          // Check if the row matches
          const matchesQuery = searchQuery === '' || searchableValues.some(value => value.includes(searchQuery));
          const matchesTags = selectedTags.length === 0 || rowTags.some(t => selectedTagsSet.has(t));

          if (matchesQuery && matchesTags) {
            results.push({
              year: rowYear || "",
              month: month || "",
              school: school || "",
              author: author || "",
              title: title || "",
              link: folderId ? `https://drive.google.com/drive/folders/${folderId}` : "#",
              tags: rowTags
            });
          }
        }
      } catch (ssError) {
        console.error(`Error processing spreadsheet ${ssId}: ${ssError.message}`);
      }
    }

    // Sort results by year (descending)
    results.sort((a, b) => Number(b.year) - Number(a.year));

    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedResults = results.slice(startIndex, endIndex);

    return {
      status: "success",
      data: {
        results: paginatedResults,
        totalResults: results.length,
        page,
        pageSize
      }
    };

  } catch (error) {
    console.error("Search error:", error);
    return {
      status: "error",
      message: "Failed to search theses: " + error.message
    };
  }
}

function getThesisAnalytics() {
  try {
    const collectionSpreadsheet = SpreadsheetApp.openById(COLLECTION_SPREADSHEET_ID);
    const mainSheet = collectionSpreadsheet.getSheetByName('Main');
    const mainData = mainSheet.getDataRange().getValues();

    const fieldCounts = {};
    const yearlyData = {};
    let totalTheses = 0;

    // Process each year's spreadsheet
    for (let i = 1; i < mainData.length; i++) {
      const [year, ssId] = mainData[i];

      if (!ssId || typeof ssId !== 'string' || ssId.trim() === '') {
        continue;
      }

      try {
        const yearSpreadsheet = SpreadsheetApp.openById(ssId);
        const yearSheet = yearSpreadsheet.getActiveSheet();
        const yearData = yearSheet.getDataRange().getValues();


        for (let j = 1; j < yearData.length; j++) {
          const row = yearData[j];
          if (row.length < 8) continue;

          const [rowYear, month, school, author, title, folderId, tags] = row;
          
          // Count by year
          yearlyData[rowYear] = (yearlyData[rowYear] || 0) + 1;

          // Count by field (using tags)
          if (tags) {
            const fieldTags = String(tags).split('|').map(t => t.trim());
            fieldTags.forEach(tag => {
              fieldCounts[tag] = (fieldCounts[tag] || 0) + 1;
            });
          }

          totalTheses++;
        }
      } catch (error) {
        console.error(`Error processing spreadsheet ${ssId}: ${error.message}`);
      }
    }

    // Calculate yearly distribution
    const yearlyDistribution = Object.entries(yearlyData)
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => a.year - b.year);

    // Calculate field distribution
    const fieldDistribution = Object.entries(fieldCounts)
      .map(([field, count]) => ({ field, count }))
      .sort((a, b) => b.count - a.count);

    // Calculate average theses per year
    const uniqueYears = Object.keys(yearlyData).length;
    const averagePerYear = Math.round(totalTheses / uniqueYears);

    // Get most active field
    const mostActiveField = fieldDistribution[0] || { field: 'N/A', count: 0 };

    return {
      totalTheses,
      averagePerYear,
      mostActiveField,
      yearlyDistribution,
      fieldDistribution
    };

  } catch (error) {
    console.error("Analytics error:", error);
    return {
      status: "error",
      message: "Failed to fetch analytics: " + error.message
    };
  }
}

function getAllTags() {
  const collectionSpreadsheet = SpreadsheetApp.openById(COLLECTION_SPREADSHEET_ID);
  const mainSheet = collectionSpreadsheet.getSheetByName('Main');
  const mainData = mainSheet.getDataRange().getValues();

  const uniqueTags = new Set();

  for (let i = 1; i < mainData.length; i++) {
    const [year, ssId, timestamp] = mainData[i];

    if (!ssId || typeof ssId !== 'string' || ssId.trim() === '') {
      continue;
    }

    try {
      const yearSpreadsheet = SpreadsheetApp.openById(ssId);
      const yearSheet = yearSpreadsheet.getActiveSheet();
      const yearData = yearSheet.getDataRange().getValues();

      for (let j = 1; j < yearData.length; j++) {
        const row = yearData[j];
        if (row.length < 8) continue;

        const tags = row[6] ? String(row[6]).split('|').map(t => t.trim()) : [];
        tags.forEach(tag => uniqueTags.add(tag));
        Logger.log(tags)
      }
    } catch (ssError) {
      console.error(`Error processing spreadsheet ${ssId}: ${ssError.message}`);
    }
  }

  return Array.from(uniqueTags).sort();
}