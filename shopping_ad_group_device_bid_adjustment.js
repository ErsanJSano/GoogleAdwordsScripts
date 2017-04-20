// Set shopping campaign name.
var SHOPPING_CAMPAIGN_NAME = "Some campaign name";

// Set timeframe.
// See: https://developers.google.com/adwords/scripts/docs/reference/adwordsapp/adwordsapp_adgroupselector#forDateRange_1.
var TIMEFRAME = "LAST_7_DAYS";

// Set script name. Used only as logger comment.
var SCRIPT_NAME = "DeviceCostBidAdjustment";

// Main function - point of entrance in code. 
function main() {
  var startDate = new Date();
  Logger.log('Starting '+SCRIPT_NAME+' for campaign "'+SHOPPING_CAMPAIGN_NAME+'"'+' script...('+startDate+')');
  // Get product group report data where impressions and cost > 0 for specified campaign and timeframe.
  var productRows = getProductPartitionReportRows();
  // Just exit if report is empty.
  if (productRows.hasNext() != true) {
    var stopDate = new Date();
    Logger.log('No data matched criteria');
    Logger.log('Stopping '+SCRIPT_NAME+' for campaign "'+SHOPPING_CAMPAIGN_NAME+'"'+' script...('+stopDate+')');
    return;
  }
  
  // Main report derived variable.
  var productData = {
    //adGroupId: {device: {formula: newCpcFormula}},
  }
  
  // Loop through each report row and get new cpc formula per adgroup and device.
  while (productRows.hasNext()) {
    var productRow    = productRows.next();
    var newCpcFormula = getNewCpcFormula(productRow);
    if (newCpcFormula === 0) { // If 0 then just continue as formula was not found.
      continue;
    }
    var device = productRow.Device.split(" ")[0];
    if (typeof productData[productRow.AdGroupId] == 'undefined') {
      productData[productRow.AdGroupId] = {};
    }
    // Build variable by ad group id and device.
    productData[productRow.AdGroupId][device] = {formula: newCpcFormula};
  }
  
  // Check for sanity. If derived product data variable is empty then just exit.
  if (isObjectEmpty(productData) == true) {
    var stopDate = new Date();
    Logger.log('Product data missing.');
    Logger.log('Stopping '+SCRIPT_NAME+' for campaign "'+SHOPPING_CAMPAIGN_NAME+'"'+' script...('+stopDate+')');
    return;
  }
  
  // Get ad group objects. It is necesary as currently adwords do not allow bid adjustment bulk upload.
  var adGroups = getAdGroups(productData);
  // Finally do update!
  updateCpc(productData, adGroups);
  var stopDate = new Date();
  Logger.log('Stopping '+SCRIPT_NAME+' for campaign "'+SHOPPING_CAMPAIGN_NAME+'"'+' script...('+stopDate+')');
}

// Returns product group report data where impressions and cost > 0 for specified campaign and timeframe.
function getProductPartitionReportRows() {
  // See: https://developers.google.com/adwords/api/docs/appendix/reports/product-partition-report
  // See: https://developers.google.com/adwords/api/docs/guides/awql
  var report = AdWordsApp.report(
    "SELECT Id, AdGroupId, Device, Cost, CostPerConversion, SearchImpressionShare "
    + " FROM PRODUCT_PARTITION_REPORT " 
    + " WHERE PartitionType = UNIT AND Impressions > 0 AND CampaignName ='"+SHOPPING_CAMPAIGN_NAME+"' AND Cost > 0 "
    + " AND CampaignStatus = ENABLED AND AdGroupStatus = ENABLED AND ProductGroup DOES_NOT_CONTAIN_IGNORE_CASE 'item id = *' "
    + " DURING " + TIMEFRAME
  ); 
  return report.rows();
}

// Returns formula for new cpc based on specified rules.
function getNewCpcFormula(row) {
  // If some rule decrease bids at the ad group level by "5%"
  return 1 - 0.05; // 1 + 0.05 for 5% increase, 1 + 0.25 for 25% increase and so on...
}

// Returns boolean result of checking object if object empty.
function isObjectEmpty(obj) {
    for(var prop in obj) {
        if(obj.hasOwnProperty(prop))
            return false;
    }
    return true;
}

// Returns ad groups keyed by ad group id based on productData also keyed by ad group id.
function getAdGroups(productData) {
  var adGroups = {};
  var adGroupIterator = AdWordsApp.shoppingAdGroups().withIds(Object.keys(productData)).get();
  while(adGroupIterator.hasNext()){
    var adGroup = adGroupIterator.next(); 
    adGroups[adGroup.getId()] = adGroup;
  }
  return adGroups;
}

// Updates ad group cpc (computers) and bid modifier for tablets and mobile devices.
function updateCpc(productData, adGroups) {
  for (var adGroupId in productData) {
    // Sanity check.
    if (productData.hasOwnProperty(adGroupId) == false || adGroups.hasOwnProperty(adGroupId) == false) {
        continue;
    }
    
    // Set bases.
    var baseCpc            = adGroups[adGroupId].bidding().getCpc();
    var currentComputerBid = baseCpc;
    
    // Do computers (desktop) first.
    if (productData[adGroupId].hasOwnProperty('Computers') == true) {
      var computerBid = baseCpc * adGroups[adGroupId].devices().getDesktopBidModifier(); // Old bid.
      currentComputerBid = baseCpc * (productData[adGroupId]['Computers']['formula']); // Recalculate current computer bid.
      if (currentComputerBid != computerBid) {
        // Set new bid.
        adGroups[adGroupId].bidding().setCpc(currentComputerBid);
      }
    }
    
    // Do tablets next.
    if (productData[adGroupId].hasOwnProperty('Tablets') == true) {
      var currentTabletModifier = adGroups[adGroupId].devices().getTabletBidModifier();
      var currentTabletBid = baseCpc * currentTabletModifier;
      var newTabletBid     = currentTabletBid * (productData[adGroupId]['Tablets']['formula']);
      // Recalculate modifier in case comp bid changed.
      var newTabletModifier = parseFloat(getModifier(currentComputerBid, newTabletBid).toFixed(4)); 
      if (newTabletModifier != currentTabletModifier) {
        adGroups[adGroupId].devices().setTabletBidModifier(newTabletModifier);
      }
    }
    
    // Finally do mobile devices in same fashion as tablets.
    if (productData[adGroupId].hasOwnProperty('Mobile') == true) {
      var currentMobileModifier = adGroups[adGroupId].devices().getMobileBidModifier();
      var currentMobileBid = baseCpc * currentMobileModifier;
      var newMobileBid     = currentMobileBid * (productData[adGroupId]['Mobile']['formula']);
      var newMobileModifier = parseFloat(getModifier(currentComputerBid, newMobileBid).toFixed(4));
      if (newMobileModifier != currentMobileModifier) {
        adGroups[adGroupId].devices().setMobileBidModifier(newMobileModifier);
      }
    }
  }
}

// Return calculated bid modifier.
function getModifier(baseBid, modifiedBid) {
	return (parseFloat(modifiedBid) / parseFloat(baseBid));
}
