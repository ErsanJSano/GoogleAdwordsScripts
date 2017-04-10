// Set shopping campaign name.
var SHOPPING_CAMPAIGN_NAME = "Some campaign name";

// Set minimum CPC in case CPC does not exist.
var MINIMUM_CPC = 1;

// Set timeframe, https://developers.google.com/adwords/scripts/docs/reference/adwordsapp/adwordsapp_adgroupselector#forDateRange_1.
var TIMEFRAME = "LAST_7_DAYS";

// Set percent based increase. 0.05 = 5%.
var CPC_INCREASE = 0.05;

// Set minimum dollar increase in case calculated value is to low. 0.01 = 1 cent.
var MIN_DOLLAR_INCREASE = 0.01 // 1 cent.

// Set script name. Used only as logger comment.
var SCRIPT_NAME = "ZeroImpressionBidAdjustment";


// Main function - point of entrance in code. 
function main() {
  var startDate = new Date();
  Logger.log('Starting '+SCRIPT_NAME+' for campaign "'+SHOPPING_CAMPAIGN_NAME+'"'+' script...('+startDate+')');
  
  // https://developers.google.com/adwords/api/docs/appendix/reports/product-partition-report
  // https://developers.google.com/adwords/api/docs/guides/awql
  var report = AdWordsApp.report(
    "SELECT Id, ProductGroup, CpcBid, PartitionType, AdGroupId, AdGroupName, CampaignName, CampaignId "
    + " FROM PRODUCT_PARTITION_REPORT " 
    + " WHERE PartitionType = UNIT AND Impressions = 0 AND CampaignName ='"+SHOPPING_CAMPAIGN_NAME+"' "
    + " AND CampaignStatus = ENABLED AND AdGroupStatus = ENABLED AND ProductGroup DOES_NOT_CONTAIN_IGNORE_CASE 'item id = *' "
    + " DURING " + TIMEFRAME
  );
  
  // https://developers.google.com/adwords/scripts/docs/reference/adwordsapp/adwordsapp_bulkuploads#newCsvUpload_2
  var upload = AdWordsApp.bulkUploads().newCsvUpload(
    ["Campaign", "Campaign Id", "Ad Group", "Ad Group Id", "Default Max. CPC", "Product Group Id", "Max. CPC", "Product Group", "Partition Type"], 
    {moneyInMicros: false}
  );
  // https://developers.google.com/adwords/scripts/docs/reference/adwordsapp/adwordsapp_csvupload#forCampaignManagement_0
  upload.forAdCampaignManagement;
  
  var rows = report.rows();
  while (rows.hasNext()) {
    var row = rows.next();
    
    var currentCpc = row.CpcBid;
    if(isNaN(parseFloat(currentCpc)) == true) {
      currentCpc = MINIMUM_CPC; // Default start
    }
    currentCpc = parseFloat(currentCpc);
    
    var newCpc = parseFloat((currentCpc + (currentCpc * CPC_INCREASE))).toFixed(2);
    // Increase at least $0.01 - caused by very very low bid. 
    if (parseFloat(newCpc) - parseFloat(currentCpc) < MIN_DOLLAR_INCREASE) {
      newCpc = (parseFloat(newCpc) + MIN_DOLLAR_INCREASE).toFixed(2);
    }
    /*
    upload.append({
      'Campaign' : row.CampaignName,
      'Campaign Id' : row.CampaignId,
      'Ad Group' : row.AdGroupName,
      'Ad Group Id' : row.AdGroupId,
      'Default Max. CPC': newCpc,
      'Max. CPC': newCpc
    });
    */
    upload.append({
      'Campaign' : row.CampaignName,
      'Campaign Id' : row.CampaignId,
      'Ad Group Id' : row.AdGroupId,
      'Product Group Id' : row.Id,
      'Max. CPC': newCpc,
      'Product Group': row.ProductGroup,
      'Partition Type': row.PartitionType
    });
  }
  
  upload.apply();
  //upload.preview();  
  var endDate = new Date();
  Logger.log('Ending '+SCRIPT_NAME+' for campaign "'+SHOPPING_CAMPAIGN_NAME+'"'+' script ('+endDate+')')+'!';
}
