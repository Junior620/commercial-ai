export type FinancialSeed = {
  name: string;
  website: string;
  category:
    | "bank"
    | "dfi"
    | "impact_fund"
    | "commodity_fund"
    | "corporate"
    | "vc_pe"
    | "family_office"
    | "agency";
  country: string;
  notes?: string;
};

export const FINANCIAL_SEEDS: FinancialSeed[] = [
  { name: "Afriland First Bank", website: "https://www.afrilandfirstbank.com", category: "bank", country: "Cameroon" },
  { name: "Commercial Bank of Cameroon", website: "https://www.cbcbankgroup.com", category: "bank", country: "Cameroon" },
  { name: "BC-PME", website: "https://www.bc-pme.cm", category: "bank", country: "Cameroon" },
  { name: "BNP Paribas", website: "https://group.bnpparibas", category: "bank", country: "France" },
  { name: "Societe Generale", website: "https://www.societegenerale.com", category: "bank", country: "France" },
  { name: "Rabobank", website: "https://www.rabobank.com", category: "bank", country: "Netherlands" },
  { name: "Standard Chartered", website: "https://www.sc.com", category: "bank", country: "UK" },
  { name: "ING", website: "https://www.ing.com", category: "bank", country: "Netherlands" },
  { name: "ABN AMRO", website: "https://www.abnamro.com", category: "bank", country: "Netherlands" },
  { name: "IFC", website: "https://www.ifc.org", category: "dfi", country: "USA" },
  { name: "Proparco", website: "https://www.proparco.fr", category: "dfi", country: "France" },
  { name: "AfDB", website: "https://www.afdb.org", category: "dfi", country: "Cote d Ivoire" },
  { name: "BDEAC", website: "https://www.bdeac.org", category: "dfi", country: "Congo" },
  { name: "FMO", website: "https://www.fmo.nl", category: "dfi", country: "Netherlands" },
  { name: "BII", website: "https://www.bii.co.uk", category: "dfi", country: "UK" },
  { name: "BIO Invest", website: "https://www.bio-invest.be", category: "dfi", country: "Belgium" },
  { name: "DEG", website: "https://www.deginvest.de", category: "dfi", country: "Germany" },
  { name: "TDB Group", website: "https://www.tdbgroup.org", category: "dfi", country: "Mauritius" },
  { name: "BlueOrchard", website: "https://www.blueorchard.com", category: "impact_fund", country: "Switzerland" },
  { name: "Mirova", website: "https://www.mirova.com", category: "impact_fund", country: "France" },
  { name: "Oikocredit", website: "https://www.oikocredit.coop", category: "impact_fund", country: "Netherlands" },
  { name: "ABC Fund", website: "https://www.abc-fund.org", category: "impact_fund", country: "Luxembourg" },
  { name: "ARAF", website: "https://acumen.org/araf", category: "impact_fund", country: "Kenya" },
  { name: "Triodos IM", website: "https://www.triodos-im.com", category: "impact_fund", country: "Netherlands" },
  { name: "Root Capital", website: "https://rootcapital.org", category: "impact_fund", country: "USA" },
  { name: "Alterfin", website: "https://www.alterfin.be", category: "impact_fund", country: "Belgium" },
  { name: "Barak Fund Management", website: "https://www.barakfund.com", category: "commodity_fund", country: "Mauritius" },
  { name: "Scipion Capital", website: "https://www.scipioncapital.com", category: "commodity_fund", country: "Switzerland" },
  { name: "StoneX", website: "https://www.stonex.com", category: "commodity_fund", country: "USA" },
  { name: "Galena Asset Management", website: "https://www.galena-asset.com", category: "commodity_fund", country: "Switzerland" },
  { name: "Trafigura", website: "https://www.trafigura.com", category: "commodity_fund", country: "Singapore" },
  { name: "Olam Food Ingredients", website: "https://www.ofi.com", category: "corporate", country: "Singapore" },
  { name: "Cargill", website: "https://www.cargill.com", category: "corporate", country: "USA" },
  { name: "Nestle", website: "https://www.nestle.com", category: "corporate", country: "Switzerland" },
  { name: "Barry Callebaut", website: "https://www.barry-callebaut.com", category: "corporate", country: "Switzerland" },
  { name: "Volcafe", website: "https://www.volcafe.com", category: "corporate", country: "Switzerland" },
  { name: "NKG", website: "https://www.nkg.coffee", category: "corporate", country: "Germany" },
  { name: "Sucafina", website: "https://www.sucafina.com", category: "corporate", country: "Switzerland" },
  { name: "Louis Dreyfus Company", website: "https://www.ldc.com", category: "corporate", country: "Netherlands" },
  { name: "Novastar Ventures", website: "https://novastarventures.com", category: "vc_pe", country: "Kenya" },
  { name: "Omnivore", website: "https://www.omnivore.vc", category: "vc_pe", country: "India" },
  { name: "The Yield Lab", website: "https://www.theyieldlab.com", category: "vc_pe", country: "USA" },
  { name: "Astanor Ventures", website: "https://www.astanor.com", category: "vc_pe", country: "Belgium" },
  { name: "AgFunder", website: "https://agfunder.com", category: "vc_pe", country: "USA" },
  { name: "Sahel Capital", website: "https://sahelcapital.com", category: "vc_pe", country: "Nigeria" },
  { name: "Ceniarth", website: "https://www.ceniarthllc.com", category: "family_office", country: "UK" },
  { name: "Rockefeller Capital Management", website: "https://www.rockco.com", category: "family_office", country: "USA" },
  { name: "DNS Capital", website: "https://www.dnscap.com", category: "family_office", country: "USA" },
  { name: "ABAN", website: "https://www.abanangels.org", category: "family_office", country: "South Africa" },
  { name: "Cameroon Angel Network", website: "https://www.cameroonangelnetwork.com", category: "family_office", country: "Cameroon" },
  { name: "ICCO", website: "https://www.icco.org", category: "agency", country: "Cote d Ivoire" },
  { name: "ICO", website: "https://www.ico.org", category: "agency", country: "UK" },
  { name: "GAFSP", website: "https://www.gafspfund.org", category: "agency", country: "USA" },
  { name: "CAFI", website: "https://www.cafi.org", category: "agency", country: "Gabon" },
  { name: "IFAD", website: "https://www.ifad.org", category: "agency", country: "Italy" },
];
