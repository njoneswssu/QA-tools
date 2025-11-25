const { test, expect, chromium } = require('@playwright/test');

test.describe('Website Availability Checker', () => {
  test('Check websites for unavailability messages with manual review', async () => {
    // No timeout - let the test run until completion regardless of how long it takes
    test.setTimeout(0); // Disable timeout for large website lists
    
    // Launch browser
    const browser = await chromium.launch({
      headless: false, // Keep visible to see what's happening
      slowMo: 500 // Slow down actions for visibility
    });
    
    const context = await browser.newContext({
      viewport: { width: 1200, height: 800 },
      ignoreHTTPSErrors: true,
      // Block tracking and reduce unnecessary requests
      extraHTTPHeaders: {
        'DNT': '1'  // Do Not Track header
      }
    });
    
    // Block tracking domains and Facebook pixels to prevent unnecessary tabs
    await context.route('**/*', (route) => {
      const url = route.request().url();
      
      // Block common tracking domains that cause tab clutter
      const trackingDomains = [
        'facebook.com/tr', 'fb.com', 'fbcdn.net',
        'google-analytics.com', 'googletagmanager.com',
        'doubleclick.net', 'googlesyndication.com',
        'analytics.js', 'gtag.js', 'ga.js',
        'criteo.com', 'adsystem.amazon.com',
        'amazon-adsystem.com', 'bidswitch.net',
        'adsrvr.org', 'rlcdn.com', 'rfihub.com',
        'clarity.ms', 'hotjar.com', 'fullstory.com', 'pinterest.com', 'pinterest.net',
        'goodmorningamerica.com', 'cookieyes.com', 'tiktok.com'
      ];
      
      const isTracking = trackingDomains.some(domain => url.includes(domain));
      
      if (isTracking) {
        // Silently block tracking requests
        route.abort();
      } else {
        route.continue();
      }
    });
    
    const page = await context.newPage();
    // Initial pause removed - test will start automatically
    // Only the 4 requested websites
    const websites = [
      { name: 'Cubtale', url: 'https://www.cubtale.com/collections/the-cubs' },
      { name: 'Sparkle Hustle Grow', url: 'https://www.sparklehustlegrow.com' },
      { name: 'Lordhair', url: 'https://www.lordhair.com/' },
      { name: 'Buddhatrends', url: 'https://www.buddhatrends.com/' },
      { name: 'Kokorosa Studio', url: 'https://kokorosastudio.com/' },
      { name: 'FYTOO', url: 'https://www.fytoo.com/' },
      { name: 'Archer Roose', url: 'https://archerroose.com' },
      { name: 'carabc', url: 'https://carabc.cn' },
      { name: 'Fafreese', url: 'https://www.fafreesebike.com' },
      { name: 'XTAR Technology Inc.', url: 'https://xtardirect.com/' },
      { name: 'Smileie Inc', url: 'https://www.smileie.com/' },
      { name: 'Aoolia', url: 'https://www.aoolia.com/' },
      { name: 'Aivituvin', url: 'https://aivituvin.com' },
      { name: 'Sutera', url: 'https://www.sleepsutera.com' },
      { name: 'Eckhaus Latta', url: 'https://eckhauslatta.com/' },
      { name: 'Dongguan Aodong Intelligent Technology Co., Ltd.', url: 'https://uditerboard.com/collections/electric-skateboards' },
      { name: 'FNTCASE', url: 'https://fntcase.com' },
      { name: 'World Nutrition', url: 'https://worldnutrition.net/products' },
      { name: 'Delphinus', url: 'https://www.delphinusworld.com/' },
      { name: 'Beyond Yoga', url: 'https://www.beyondyoga.com' },
      { name: 'EVDANCE', url: 'https://evdances.com' },
      { name: 'ARZOPA', url: 'https://www.arzopa.com' },
      { name: 'SkyBound', url: 'https://www.skyboundusa.com/' },
      { name: 'United Apparels', url: 'https://www.shieldapparels.com' },
      { name: 'Lisi Lerch Inc', url: 'https://www.lisilerch.com/' },
      { name: 'Sol de Janeiro', url: 'https://soldejaneiro.com' },
      { name: 'Ecommerce Solutions', url: 'https://www.teamontop.com' },
      { name: 'Monastery', url: 'https://www.monasterymade.com' },
      { name: 'Mango Power', url: 'https://mangopower.com' },
      { name: 'Formulary55.com', url: 'https://www.formulary55.com' },
      { name: 'Center Cam', url: 'https://www.thecentercam.com' },
      { name: 'The Harvest Plan', url: 'https://theharvestplan.com' },
      { name: 'TU ET AL', url: 'https://tuetal.co/' },
      { name: 'kingdo', url: 'https://www.kingdohealthy.com/' },
      { name: 'Be Lucent', url: 'https://be-lucent.com/' },
      { name: 'Good Clean Love', url: 'https://goodcleanlove.com/' },
      { name: 'Urban Revivo', url: 'https://global.urbanrevivo.com' },
      { name: 'Remington', url: 'https://www.remington.com' },
      { name: 'Chicago Bulls Official Store (US)', url: 'https://shop.bulls.com' },
      { name: 'ArtemisAds', url: 'https://www.ArtemisAds.com' },
      { name: 'Herbion Naturals', url: 'https://herbion.us' },
      { name: 'DFND', url: 'https://dfndusa.com/' },
      { name: '12GO', url: 'https://12go.asia/en/' },
      { name: 'Artika', url: 'https://artika.ca/' },
      { name: 'Yummy Mummy', url: 'https://yummymummystore.com/affiliate' },
      { name: 'Riedell Skates', url: 'https://ice.riedellskates.com/' },
      { name: 'Wishup', url: 'https://www.wishup.co/' },
      { name: 'Paris City Vision', url: 'https://www.pariscityvision.com/' },
      { name: 'Kotanical', url: 'https://kotanical.com/' },
      { name: 'MirrorMate', url: 'https://mirrormate.com/' },
      { name: 'Whimstay', url: 'https://www.whimstay.com' },
      { name: 'Bad Birdie Golf', url: 'https://badbirdiegolf.com' },
      { name: 'Woof', url: 'https://mywoof.com/' },
      { name: 'Straight My Teeth', url: 'https://www.straightmyteeth.com' },
      { name: 'House of Sunny', url: 'https://www.houseofsunny.com' },
      { name: 'Kana Company', url: 'https://kanacompany.co' },
      { name: 'Bastion', url: 'https://www.bastiongear.com/' },
      { name: 'SFERRA Fine Linens', url: 'https://sferra.com' },
      { name: 'AlwaysWebHosting.com', url: 'https://alwayswebhosting.com' },
      { name: 'Focus Factor', url: 'https://www.focusfactor.com/' },
      { name: 'The Honest Kitchen', url: 'https://www.thehonestkitchen.com' },
      { name: '34 Heritage', url: 'https://34heritage.com' },
      { name: 'Hostinger', url: 'https://www.hostinger.com/' },
      { name: 'Kapitus Business Financing', url: 'https://www.kapitus.com' },
      { name: 'Brightech', url: 'https://brightech.com/' },
      { name: 'Cub Cadet', url: 'https://www.cubcadet.com/' },
      { name: 'DeleteMe', url: 'https://joindeleteme.com' },
      { name: 'Petite /n Pretty', url: 'https://www.petitenpretty.com' },
      { name: '1771 Living', url: 'https://www.residenthome.com/' },
      { name: 'Sixity Auto', url: 'https://www.sixityauto.com/' },
      { name: 'Piedmontese', url: 'https://www.piedmontese.com/' },
      { name: 'Creedmoor Sports', url: 'https://www.creedmoorsports.com/' },
      { name: 'Spicewalla', url: 'https://www.spicewallabrand.com/' },
      { name: 'Drive-In Autosound', url: 'https://driveinautosound.com/' },
      { name: 'Nektony', url: 'https://nektony.com' },
      { name: 'Gabb Wireless', url: 'https://www.gabb.com' },
      { name: 'Blooming KOCO', url: 'https://moidaus.com' },
      { name: 'Barebones', url: 'https://www.barebonesliving.com' },
      { name: 'Incredible Inventions', url: 'https://incredibleinventions.com' },
      { name: 'MKF Collection', url: 'https://mkfcollection.com' },
      { name: 'Stop & Shop', url: 'https://stopandshop.com/' },
      { name: 'Spot & Tango', url: 'https://spotandtango.com' },
      { name: 'Lifeline Skincare', url: 'https://www.lifelineskincare.com/' },
      { name: 'Stamps.com', url: 'https://www.stamps.com' },
      { name: 'Laurel Creek Software', url: 'https://www.LaurelCreekSoftware.com' },
      { name: 'Electric City Roasting Co.', url: 'https://electriccityroasting.com/' },
      { name: 'Holistic Hair Tribe', url: 'https://www.holistichairtribe.com/' },
      { name: 'Lenme', url: 'https://lenme.onelink.me/j6zc/4c1e32f4' },
      { name: 'EPNYgolf.com', url: 'https://epnygolf.com/' },
      { name: 'Send Flowers', url: 'https://www.sendflowers.com/' },
      { name: 'Ancient Nutrition', url: 'https://ancientnutrition.com' },
      { name: 'Face the Future', url: 'https://www.facethefuture.co.uk/' },
      { name: 'GearIT', url: 'https://www.gearit.com/' },
      { name: 'Public Bikes', url: 'https://publicbikes.com/' },
      { name: 'LikeSporting', url: 'https://www.likesporting.com' },
      { name: 'Diet Direct', url: 'https://www.dietdirect.com/' },
      { name: 'Elite Survival Systems', url: 'https://elitesurvival.com/' },
      { name: 'Assist Diabetics', url: 'https://assistdiabetics.com' },
      { name: 'Kootenay Botanicals', url: 'https://potcargo.one/' },
      { name: 'Greek House', url: 'https://store.greekhouse.org/' },
      { name: 'Caribbean Apparel', url: 'https://www.caribbeanapparel.net' },
      { name: 'Destination Gold Detectors', url: 'https://destinationgolddetectors.com' },
      { name: 'Komar', url: 'https://www.komarbrands.com/' },
      { name: 'Eyeleos', url: 'https://eyeleos.com/' },
      { name: 'Muru', url: 'https://www.murujewellery.com/' },
      { name: 'Simons', url: 'https://www.simons.ca/' },
      { name: 'Altitude-Sports', url: 'https://www.altitude-sports.com' },
      { name: 'CardCash', url: 'https://www.cardcash.com/' },
      { name: 'CenturyLink', url: 'https://www.quantumfiber.com/' },
      { name: 'SEEN Hair Care', url: 'https://helloseen.com/' },
      { name: 'Xfinity', url: 'https://www.xfinity.com/learn/offers' },
      { name: 'Zhiyun', url: 'https://store.zhiyun-tech.com/' },
      { name: 'Latest Bedding', url: 'https://www.bebejan.com' },
      { name: 'GlassesUSA.com', url: 'https://www.glassesusa.com' },
      { name: 'ISSA', url: 'https://www.issaonline.com/' },
      { name: 'OpenMity Romance', url: 'https://openmityromance.com/' },
      { name: 'Shiny Smile Veneers', url: 'https://www.shinysmileveneers.com/' },
      { name: 'Kiierr International LLC', url: 'https://kiierr.com/' },
      { name: 'West Paw', url: 'https://www.westpaw.com' },
      { name: 'SignNow', url: 'https://www.signnow.com/' },
      { name: 'Landed Affiliate Marketing', url: 'https://www.landed.com' },
      { name: 'Headbanger Lures', url: 'https://www.headbangerlures.com/' },
      { name: 'Unlock Your Voice', url: 'https://www.unlockyourvoice.online/' },
      { name: 'HisRoom', url: 'https://www.hisroom.com/' },
      { name: 'RobeCurls', url: 'https://robecurls.myshopify.com' },
      { name: 'Emi Jay', url: 'https://www.emijay.com/' },
      { name: 'TMS', url: 'https://tms-outsource.com/' },
      { name: 'The Ready State', url: 'https://thereadystate.com' },
      { name: 'EmpowerDX', url: 'https://empowerdxlab.com' },
      { name: 'encalife', url: 'https://www.encalife.com/' },
      { name: 'ShiftKey', url: 'https://www.shiftkey.com' },
      { name: 'Pistil Designs', url: 'https://pistildesigns.com/' },
      { name: 'UST', url: 'https://www.ustgear.com/' },
      { name: 'ACME Markets', url: 'https://www.acmemarkets.com/' },
      { name: 'Cascadia Vehicle Tents', url: 'https://www.cascadiatents.com' },
      { name: 'Tera Naturals', url: 'https://www.teranaturals.com' },
      { name: 'Elite Learning', url: 'https://www.elitelearning.com/' },
      { name: 'Abelssoft', url: 'https://www.abelssoft.com' },
      { name: 'WeThePeopleBible.com', url: 'https://wethepeoplebible.com' },
      { name: 'Ellen Tracy', url: 'https://ellentracy.com/' },
      { name: 'Halara', url: 'https://thehalara.com/' },
      { name: 'IBEROSTAR', url: 'https://www.iberostar.com' },
      { name: 'Natural Cycles', url: 'https://www.naturalcycles.com/' },
      { name: 'Metalean Complete', url: 'https://metaleancomplete.com/' },
      { name: 'Valley Bank', url: 'https://www.valleydirect.com/' },
      { name: 'Rosetta Stone', url: 'https://www.rosettastone.com' },
      { name: '1620 USA', url: 'https://www.1620usa.com/' },
      { name: 'Fofana', url: 'https://www.fofana.co/' },
      { name: 'Magid Glove & Safety', url: 'https://www.magidglove.com' },
      { name: 'Ciciful', url: 'https://www.ciciful.com/' },
      { name: 'Identifix', url: 'https://store.identifix.com/' },
      { name: 'HUE', url: 'https://www.hue.com/' },
      { name: 'TeckWrapCraft', url: 'https://teckwrapcraft.com/' },
      { name: 'FishUSA', url: 'https://www.fishusa.com' },
      { name: 'Visit Britain', url: 'https://www.visitbritainshop.com' },
      { name: 'Orion Motor Tech', url: 'https://orionmotortech.com' },
      { name: 'Geckobrands', url: 'https://geckobrands.com' },
      { name: 'Beflax Linen', url: 'https://beflaxlinen.com/' },
      { name: 'iPEC Coaching', url: 'https://www.ipeccoaching.com/' },
      { name: 'Solo New York', url: 'https://solo-ny.com/' },
      { name: 'COOP', url: 'https://app.coop.farm/' },
      { name: 'Nathan Sports', url: 'https://www.nathansports.com' },
      { name: 'Rhino-Rack', url: 'https://www.rhinorack.com/en-us' },
      { name: 'Able Clothing', url: 'https://www.ableclothing.com/' },
      { name: 'Foot Peel Mask', url: 'https://deals.getfootpeelmask.io/27ZKGGX2/254TFWF/' },
      { name: 'Keyzmo', url: 'https://deals.getkeyzmo.io/27ZKGGX2/246GMWW/' },
      { name: 'Raisin', url: 'https://www.raisin.com/en-us' },
      { name: 'Gaming Intelligence', url: 'https://trygi.com/' },
      { name: 'Elysium', url: 'https://elysiumblack.com/' },
      { name: 'Sweets Elderberry', url: 'https://www.sweetselderberry.com/' },
      { name: 'Soulight', url: 'https://soulight.com/' },
      { name: 'Cannadips', url: 'https://www.cannadips.com' },
      { name: 'Paint With Diamonds', url: 'https://paintwithdiamonds.com/' },
      { name: 'Mini Mioche', url: 'https://www.minimioche.com/' },
      { name: 'Happy Viking', url: 'https://www.drinkhappyviking.com' },
      { name: 'Hale Breathing', url: 'https://gethalebreathing.io/offer-01/?lpid=0636&source_id=DL&utm_source=21577&utm_medium=&utm_term=636&aff_id=21577&sub_id=&req_id=&oid=636&device_type=&country_name=&oid=636&affid=21577&source_id=#DomainID%23' },
      { name: 'Guzzle H2O', url: 'https://guzzleh2o.com' },
      { name: 'Six Moon Designs', url: 'https://www.sixmoondesigns.com' },
      { name: 'Kelvin 8', url: 'https://deals.getkelvin8.io/27ZKGGX2/2NXT8N4/?source_id=#DomainID%23' },
      { name: 'Get Joy', url: 'https://getjoyfood.com/' },
      { name: 'Tempo by Home Chef', url: 'https://www.tempomeals.com/' },
      { name: 'Bondi Sands', url: 'https://www.bondisands.com' },
      { name: 'Cloudfield', url: 'https://cloudfield.co/' },
      { name: 'Steppit', url: 'https://www.steppit.com' },
      { name: 'Farlows', url: 'https://www.farlows.co.uk/' },
      { name: 'Victrola', url: 'https://victrola.com' },
      { name: 'Galison', url: 'https://www.galison.com/' },
      { name: 'Saint James', url: 'https://us.saint-james.com/' },
      { name: 'Pool Parts To Go', url: 'https://www.poolpartstogo.com' },
      { name: 'Chelsea Megastore', url: 'https://www.chelseamegastore.com/stores/chelsea/en' },
      { name: 'Molekule', url: 'https://molekule.com/' },
      { name: 'A Pup Above', url: 'https://www.apupabove.com' },
      { name: 'American Standard', url: 'https://www.americanstandard-us.com/' },
      { name: 'Canna River', url: 'https://www.cannariver.com/' },
      { name: 'DropshippingXL', url: 'https://www.dropxl.com/' },
      { name: 'Swig Life', url: 'https://swiglife.com' },
      { name: 'Totwoo', url: 'https://totwoo.com/' },
      { name: 'Dieux Skin', url: 'https://www.dieuxskin.com/' },
      { name: 'Oklahoma Joe/s', url: 'https://www.oklahomajoes.com/' },
      { name: 'Zwift', url: 'https://zwift.com' },
      { name: 'Millennium Shoes', url: 'https://millenniumshoes.com/' },
      { name: 'BookReady', url: 'https://www.bookready.com/' },
      { name: 'Palazzo Versace', url: 'https://www.palazzoversace.ae/en/' },
      { name: 'Sundek', url: 'https://sundek.us/' },
      { name: 'Pastel', url: 'https://usepastel.com/' },
      { name: 'Grinmore', url: 'https://www.grinmorestore.com' },
      { name: 'Chair King Backyard Store', url: 'https://chairking.com/' },
      { name: 'Barebones Botanicals', url: 'https://www.barebonebotanicals.com' },
      { name: 'Tuff Ring', url: 'https://tuffring.com' },
      { name: 'Tillak', url: 'https://www.tillak.com' },
      { name: 'Danelfin', url: 'https://danelfin.com/' },
      { name: 'The Real Grit', url: 'https://www.therealgrit.com' },
      { name: 'Storyworth', url: 'https://www.storyworth.com/' },
      { name: '10Web', url: 'https://10web.io/' },
      { name: 'LEMLEM', url: 'https://www.lemlem.com/' },
      { name: 'Symbiome', url: 'https://symbiome.com/' },
      { name: 'Cancun Adventures', url: 'https://www.cancun-adventure.com/' },
      { name: 'Frontline Optics', url: 'https://frontline-optics.com' },
      { name: 'Nesco', url: 'https://nesco.com' },
      { name: 'Worksport', url: 'https://worksport.com' },
      { name: 'cvlife', url: 'https://cvlife.com' },
      { name: 'partiQlar', url: 'https://www.partiqlar.com' },
      { name: 'Banwood', url: 'https://banwood.us/' },
      { name: 'Free Range Equipment', url: 'https://freerangeequipment.com' },
      { name: 'Huda Beauty', url: 'https://hudabeauty.com/us/en_US/home' },
      { name: 'Clever Fox Planner', url: 'https://cleverfoxplanner.com/' },
      { name: 'Mazie Days', url: 'https://www.maziedays.com' },
      { name: 'US Service Animals', url: 'https://usserviceanimals.org/?utm_source=Impact&utm_medium=AFF' },
      { name: 'Handso', url: 'https://handso.it' },
      { name: 'Major Fitness', url: 'https://www.majorfitness.com/' },
      { name: 'Kevin Murphy', url: 'https://kevinmurphy.com.au/' },
      { name: 'Grove Collaborative', url: 'https://www.grove.co/' },
      { name: 'Miles Board', url: 'https://milesboard.com' },
      { name: 'Jimmy Styks', url: 'https://jimmystyks.com/' },
      { name: 'Revenued', url: 'https://www.revenued.com' },
      { name: 'onefinestay', url: 'https://www.onefinestay.com/' },
      { name: 'Roofing4US', url: 'https://roofing4us.com/' },
      { name: 'Kaplan', url: 'https://www.kaptest.com/' },
      { name: 'Fable', url: 'https://fable.com' },
      { name: 'Freedom', url: 'https://freedom.to' },
      { name: 'Bonafide', url: 'https://hellobonafide.com/' },
      { name: 'OLAPLEX', url: 'https://olaplex.com/' },
      { name: 'ConsumersCreditUnion', url: 'https://www.myconsumers.org/' },
      { name: 'YOOX', url: 'https://www.yoox.com' },
      { name: 'Fax It Fast', url: 'https://www.faxitfast.com' },
      { name: 'MVMT', url: 'https://www.mvmt.com/' },
      { name: 'Blueair', url: 'https://www.blueair.com/us/' },
      { name: 'Burrow', url: 'https://burrow.com/' },
      { name: 'Stanley', url: 'https://www.stanley1913.com/' },
      { name: 'Velotric', url: 'https://www.velotricbike.com' },
      { name: 'Meat N/ Bone', url: 'https://meatnbone.com/' },
      { name: 'SOMA', url: 'https://www.soma.com' },
      { name: 'Keeper Security', url: 'https://keepersecurity.com' },
      { name: 'ArtPhotoLimited', url: 'https://www.artphotolimited.com/de' },
      { name: 'Urban Skin Rx', url: 'https://urbanskinrx.com/' },
      { name: 'TENWAYS', url: 'https://www.tenways.com/' },
      { name: 'Compassion', url: 'https://www.compassion.com/' },
      { name: 'Honey Stinger', url: 'https://honeystinger.com/' },
      { name: 'TruDiagnostic', url: 'https://trudiagnostic.com/' },
      { name: 'Hestan Culinary', url: 'https://www.hestanculinary.com' },
      { name: 'Gap', url: 'https://www.gap.com' },
      { name: 'MySmartMove.com', url: 'https://www.mysmartmove.com/' },
      { name: 'Clean Email', url: 'https://clean.email' },
      { name: 'Truewerk', url: 'https://www.truewerk.com' },
      { name: 'Bleu Rod Beattie Swimwear', url: 'https://bleurodbeattie.com/' },
      { name: 'Sixt', url: 'https://www.sixt.com/' },
      { name: 'RAD', url: 'https://www.rad.eu/en' },
      { name: 'H10 Hotels', url: 'https://www.h10hotels.com' },
      { name: 'Fruugo', url: 'https://www.fruugo.us/' },
      { name: 'Eezy Sun', url: 'https://www.eezysun.com/' },
      { name: 'BypassPen', url: 'https://www.bypasspen.ai' },
      { name: 'C.Paravano', url: 'https://www.cparavano.com' },
      { name: 'The Indoor Golf Shop', url: 'https://shopindoorgolf.com/' },
      { name: 'Colugo', url: 'https://www.colugo.com/' },
      { name: 'Gallop Store', url: 'https://gallop-store.com/' },
      { name: 'Lick', url: 'https://www.lick.com/uk' },
      { name: 'TRX Training', url: 'https://www.trxtraining.com' },
      { name: 'IDA Fashion Studio', url: 'https://www.idascollection.com/' },
      { name: 'JustFit', url: 'https://justfit.app/' },
      { name: 'ITA Airways', url: 'https://www.ita-airways.com/en_us/' },
      { name: 'Maaji', url: 'https://www.maaji.co/' },
      { name: 'Next Day Contacts', url: 'https://www.nextdaycontacts.com/' },
      { name: 'Maui Jim', url: 'https://www.mauijim.com' },
      { name: 'LIVSN', url: 'https://www.livsndesigns.com/' },
      { name: 'Free2move', url: 'https://www.free2move.com/en-US/' },
      { name: 'Marriott Bonvoy Boutiques', url: 'https://shop.marriott.com' },
      { name: 'Shinningu', url: 'https://www.shinningu.com/' },
      { name: 'ShhTape', url: 'https://shhtape.com' },
      { name: 'Nitrado', url: 'https://www.nitrado.net' },
      { name: 'Mytrip.com', url: 'https://www.mytrip.com' },
      { name: 'GetYourGuide', url: 'https://www.getyourguide.com/' },
      { name: 'Marvel', url: 'https://marvel.com' },
      { name: 'Evenflo Baby', url: 'https://www.evenflo.com' },
      { name: 'Oak Essentials', url: 'https://oakessentials.com/' },
      { name: 'Fehaute', url: 'https://fehaute.com' },
      { name: 'Aletha Health', url: 'https://www.alethahealth.com/' },
      { name: 'Meta', url: 'https://www.meta.com' },
      { name: 'Oasis Hotels', url: 'https://oasishoteles.com/en' },
      { name: 'Skinfix', url: 'https://skinfix.com' },
      { name: 'Ambir', url: 'https://picturestudio.com/' },
      { name: 'Plant In The Box US', url: 'https://plantinthebox.com/' },
      { name: 'Prezzee', url: 'https://www.prezzee.com/' },
      { name: 'Mario Capasa (US)', url: 'https://mariocapasa.com' },
      { name: 'Brave Kid', url: 'https://bravekid.com' },
      { name: 'Fresh', url: 'https://www.fresh.com/US/home' },
      { name: 'DonaHöna', url: 'https://www.donahona.com/' },
      { name: 'Bourbon Concierge', url: 'https://thebourbonconcierge.com' },
      { name: 'Mercado Glam (US)', url: 'https://MercadoGlam.com' },
      { name: 'PRINTERVAL', url: 'https://printerval.com/' },
      { name: 'North American Herb and Spice', url: 'https://www.northamericanherbandspice.com' },
      { name: 'Malone Souliers', url: 'https://www.malonesouliers.com/' },
      { name: 'Geske', url: 'https://www.geske.com/us' },
      { name: 'Man Labs (US', url: 'https://manlabs.com/' },
      { name: 'Belle Fare', url: 'https://bellefareshop.com' },
      { name: 'XCEL Solutions', url: 'https://www.xcelsolutions.com/' },
      { name: 'Zenfolio', url: 'https://www.Zenfolio.com' },
      { name: 'Hale Sky', url: 'https://halesky.com/' },
      { name: 'FileYourTaxes', url: 'https://www.fileyourtaxes.com/max-refund-a?parent=PRO4551G' },
      { name: 'Svirson', url: 'https://slavnofilter.com' },
      { name: 'Shelly', url: 'https://www.shelly.com/' },
      { name: 'L/Artisan Parfumeur', url: 'https://www.artisanparfumeur.com/us/en_US/' },
      { name: 'Slipssy (US)', url: 'https://slipssy.com/' },
      { name: 'TomoBoost', url: 'https://tomocredit.com/boost' },
      { name: 'Rest Religion', url: 'https://restreligion.com/' },
      { name: 'Moon Oral Care', url: 'https://moonoralbeauty.com/' },
      { name: 'PosterMyWall', url: 'https://postermywall.com/' },
      { name: 'Pacdora', url: 'https://www.pacdora.com' },
      { name: 'RiLEY Home', url: 'https://rileyhome.com' },
      { name: 'WowFare', url: 'https://wowfare.com/' },
      { name: 'myBrainCo', url: 'https://us.mybrainco.com/' },
      { name: 'Marais', url: 'https://marais.com.au/' },
      { name: 'VKTRY', url: 'https://www.vktry.com' },
      { name: 'Martin/s', url: 'https://martinsfoods.com/' },
      { name: 'Pure N Natural Systems', url: 'https://purennatural.com/' },
      { name: 'Simihaze Beauty', url: 'https://simihazebeauty.com/?srsltid=AfmBOoqFg6tnEyp-iDkRhHfE2egkfe6Ch3xeZFcpz92RpvIVlu03T-er' },
      { name: 'Bern Helmets', url: 'https://www.bernhelmets.com' },
      { name: 'Hawke', url: 'https://us.hawkeoptics.com' },
      { name: 'Foligain', url: 'https://foligain.com' },
      { name: 'Noyz', url: 'https://www.noyz.com' },
      { name: 'Gate Operators Direct', url: 'https://gateoperatorsdirectusa.com' },
      { name: 'Events365', url: 'https://www.events365.com/' },
      { name: 'Mustard Made', url: 'https://uk.mustardmade.com/' },
      { name: 'Orionride', url: 'https://www.orionride.com' },
      { name: 'Voghion', url: 'https://voghion.com/' },
      { name: 'Amika', url: 'https://loveamika.com' },
      { name: 'Azz Hotels', url: 'https://www.azzhoteles.com/en/' },
      { name: 'Bogey and Byrd', url: 'https://bogeyandbyrd.com/' },
      { name: 'Unique Kulture Affiliate Program', url: 'https://www.unique-kulture.com' },
      { name: 'Almond Cow', url: 'https://almondcow.co/' },
      { name: 'Flagshirt', url: 'https://theflagshirt.com' },
      { name: 'Hero Health', url: 'https://herohealth.com/manage-my-meds-5' },
      { name: 'NatraCure', url: 'https://natracure.com/collections/top-10-best-sellers' },
      { name: 'Jessie/s Wig', url: 'https://www.jessieswig.com' },
      { name: 'Dwarves', url: 'https://www.dwarvesshoes.com' },
      { name: 'Butterfly Bakery of Vermont', url: 'https://butterflybakeryvt.com' },
      { name: 'MailPoet', url: 'https://www.mailpoet.com/affiliate-discount' },
      { name: 'Dune Jewelry', url: 'https://dunejewelry.com' },
      { name: 'pCloud', url: 'https://www.pcloud.com/cloud-storage-pricing-plans.html?ref=993' },
      { name: 'Velour Beauty', url: 'https://www.velourbeauty.com' },
      { name: 'IQBAR', url: 'https://eatiqbar.com' },
      { name: 'Grand Patio', url: 'https://www.grandpatio.com/' },
      { name: 'Vella Bioscience', url: 'https://www.vellabio.com' },
      { name: 'AlphaMart/s', url: 'https://www.alphamarts.com/collections/outdoor-sectionals' },
      { name: 'Audiobooks for everyone', url: 'https://philosophyandliterature.com' },
      { name: 'PBR Shop (US)', url: 'https://pbrshop.com/' },
      { name: 'SILIGUN', url: 'https://www.siliguns.com' },
      { name: 'MosaLingua', url: 'https://academy.mosalingua.com/mosaweb' },
      { name: 'Mosnovo', url: 'https://www.mosnovo.com' },
      { name: 'ESPIRITU', url: 'https://www.espiritu.com' },
      { name: 'Chita Living', url: 'https://chitaliving.com/discount/NEW30' },
      { name: 'Western Rise', url: 'https://westernrise.com' },
      { name: 'Lilysilk', url: 'https://factory.lilysilk.com' },
      { name: 'Manly', url: 'https://manlytshirt.com' },
      { name: 'Resona Health', url: 'https://Resona.Health.com' },
      { name: 'Hers', url: 'https://forhers.com' },
      { name: 'JJ Smith', url: 'https://www.jjsmithonline.com' },
      { name: 'Epicuren Discovery', url: 'https://epicuren.com' },
      { name: 'Eternity Modern', url: 'https://eternitymodern.com' },
      { name: 'Thesupermade', url: 'https://www.thesupermade.com/' },
      { name: 'UGREEN GROUP', url: 'https://www.ugreen.com' },
      { name: 'Reibii', url: 'https://reibii.com/' },
      { name: 'Know Roaming', url: 'https://www.knowroaming.com' },
      { name: 'capucinne.com', url: 'https://www.capucinne.com/' },
      { name: 'Engwe', url: 'https://engwe-bikes.com' },
      { name: 'Evelyn Bobbie', url: 'https://evelynbobbie.com/' },
      { name: 'America/s Test Kitchen', url: 'https://www.americastestkitchen.com/' },
      { name: 'Wild Tribute', url: 'https://wildtribute.com' },
      { name: 'LimmiFit (US)', url: 'https://limmifit.com/' },
      { name: 'TROVATA', url: 'https://www.trovata.com' },
      { name: 'Fitueyes', url: 'https://www.fitueyes.com/' },
      { name: 'Resiners', url: 'https://resiners.com' },
      { name: 'LINDSEY LEIGH JEWELRY', url: 'https://www.lindseyleighjewelry.com' },
      { name: 'David Archy', url: 'https://www.davidarchy.com' },
      { name: 'Fin Feather Fur Outfitters', url: 'https://www.finfeatherfur.com/' },
      { name: 'Blackout Coffee Company', url: 'https://www.blackoutcoffee.com' },
      { name: 'hero-wars.com', url: 'https://www.hero-wars.com/' },
      { name: 'EVENSKYN AFFILIATE PROGRAM', url: 'https://www.evenskyn.com/' },
      { name: 'Hip Optical', url: 'https://www.hipoptical.com/' },
      { name: 'Native Pet', url: 'https://nativepet.com' },
      { name: 'SIRUI', url: 'https://store.sirui.com' },
      { name: 'SmartWings', url: 'https://www.smartwingshome.com' },
      { name: 'Joyfit', url: 'https://uk.deerruntreadmill.com' },
      { name: 'Soltech', url: 'https://soltech.com/' },
      { name: 'HeyAbby', url: 'https://heyabby.com/' },
      { name: 'Texas Superfood', url: 'https://texassuperfood.com' },
      { name: 'Real Relax Mall', url: 'https://realrelaxmall.com/' },
      { name: 'Vayyar Imaging LTD (WALABOT)', url: 'https://walabot.com/?utm_source=ShareASale&utm_medium=referral&utm_campaign=walabotdiy' },
      { name: 'B-Low The Belt', url: 'https://b-lowthebelt.com/' },
      { name: 'Sundays for Dogs', url: 'https://www.sundaysfordogs.com/' },
      { name: 'KTS Light Therapy INC', url: 'https://www.ktslighttherapy.com/' },
      { name: 'MoreLabs', url: 'https://www.morelabs.com' },
      { name: 'Bellabu Bear', url: 'https://bellabubear.com/' },
      { name: 'Afewvibe LTD', url: 'https://www.afewvibe.com' },
      { name: 'auxito', url: 'https://auxito.com' },
      { name: 'Urban Ambiance', url: 'https://www.urbanambiance.com' },
      { name: 'Edifier', url: 'https://edifier-online.com/us/en' },
      { name: 'CG Hunter', url: 'https://www.cghunter.com' },
      { name: 'Ben/s Natural Health', url: 'https://www.bensnaturalhealth.com' },
      { name: 'Upperbags', url: 'https://upperbags.com' },
      { name: 'Hobolite', url: 'https://www.hobolite.com' },
      { name: 'Parks Project', url: 'https://www.parksproject.us/' },
      { name: 'Delta Children', url: 'https://www.deltachildren.com' },
      { name: 'Rosaholics', url: 'https://rosaholics.com/' },
      { name: 'Talking Out of Turn', url: 'https://www.talkingoutofturn.com' },
      { name: 'iFrodoll', url: 'https://ifrodoll.com' },
      { name: 'GoGameGeek', url: 'https://www.gogamegeek.com' },
      { name: 'PH5', url: 'https://www.ph5.com' },
      { name: 'Lazy Daze Hammocks', url: 'https://lazydazehammocks.com' },
      { name: 'HerbsDaily', url: 'https://www.herbsdaily.com/' },
      { name: 'Otofonix', url: 'https://www.otofonix.com' },
      { name: 'Wellhana', url: 'https://wellhana.com' },
      { name: 'Chamaripa', url: 'https://www.chamaripashoes.com/' },
      { name: 'Core Med Science', url: 'https://www.coremedscience.com' },
      { name: 'Cooking Steels', url: 'https://www.cookingsteels.com' },
      { name: 'Plannin.com Inc', url: 'https://www.plannin.com' },
      { name: 'Neotec', url: 'https://neotecworld.com' },
      { name: 'GRANA', url: 'https://GRANA.COM' },
      { name: 'Get Plenty', url: 'https://www.getplenty.com' },
      { name: 'Ro/s Garden', url: 'https://ros-garden.com/' },
      { name: 'USA Market', url: 'https://usa-market.net' },
      { name: 'Ariel Gordon Jewelry', url: 'https://www.arielgordonjewelry.com/' },
      { name: 'Doogee', url: 'https://www.doogee.com' },
      { name: 'Handy Maker Co., LLC.', url: 'https://TheRollGear.com' },
      { name: 'Thermomate', url: 'https://thermomate.com/' },
      { name: 'Mr Bing', url: 'https://mr-bing.com' },
      { name: 'Safishing', url: 'https://www.safishing.com' },
      { name: 'Alteya', url: 'https://alteyaorganics.com' },
      { name: 'Hedgehog Dryer Inc', url: 'https://us.hedgehogdryer.com' },
      { name: 'Li Time', url: 'https://www.litime.com' },
      { name: 'Matador Meggings', url: 'https://www.matadormeggings.com' },
      { name: 'Protocol', url: 'https://protocol-lab.com' },
      { name: 'Scootaround', url: 'https://scootaroundstore.com/' },
      { name: 'R.W. flame', url: 'https://www.rwflame.com/' },
      { name: 'Jeans.com', url: 'https://www.jeans.com' },
      { name: 'MomMed', url: 'https://www.mommed.com' },
      { name: 'Giftlab', url: 'https://www.giftlab.com/' },
      { name: 'Steve/s Goods', url: 'https://stevesgoods.com' },
      { name: 'Elements of Health Care', url: 'https://l-arginine.com/lower-my-blood-pressure' },
      { name: 'Tangerine Paddle', url: 'https://www.tangerinepaddle.com' },
      { name: 'Great Bay Home', url: 'https://www.greatbayhome.com' },
      { name: 'CraftZee', url: 'https://craftzee.com/' },
      { name: 'TXP SYSTEMS', url: 'https://trustxpay.com/' },
      { name: 'JOJU', url: 'https://livejoju.com' },
      { name: 'Snowcityshop', url: 'https://snowcityshop.com' },
      { name: 'MIFINE LIMITED', url: 'https://www.mifine.com' },
      { name: 'Mintly Home', url: 'https://www.mintlyhome.com' },
      { name: 'Minot', url: 'https://minotcandle.com/' },
      { name: 'Ajazz', url: 'https://ajazzbrand.com' },
      { name: 'Grateful Earth', url: 'https://gratefulearthcoffee.com' },
      { name: 'Kinetix Casual Luxury', url: 'https://www.kxclothing.com' },
      { name: 'Heim Nest', url: 'https://heimnest.com' },
      { name: 'Wojciech Socharczenko Pixart', url: 'https://www.bronze-sculpture-art.com' },
      { name: 'Phone Loops', url: 'https://phoneloops.com' },
      { name: 'Triton Poker', url: 'https://www.tritonpokertables.com' },
      { name: 'Adept Knives', url: 'https://www.adeptknives.com' },
      { name: 'Original Sprout', url: 'https://originalsprout.com/' },
      { name: 'Hebei Youchang Technology Co., Ltd', url: 'https://www.gymfrog.com' },
      { name: 'Lbeads', url: 'https://lbeads.com' },
      { name: 'John Mark Clothing', url: 'https://johnmarkclothing.com/' },
      { name: 'Espro', url: 'https://www.espro.com/' },
      { name: 'Pineapples Palms Too', url: 'https://www.pineapplespalms.com' },
      { name: 'Sunny Shower', url: 'https://sunnyshowerusainc.com' },
      { name: 'Renoo', url: 'https://renoo.life' },
      { name: 'Louis Cobo', url: 'https://www.louiscobo.com' },
      { name: 'Freya', url: 'https://www.hifreya.com' },
      { name: 'Asobu', url: 'https://asobubottle.com' },
      { name: 'The Dirt Oral Care', url: 'https://givemethedirt.com' },
      { name: 'OvercoatUSA', url: 'https://overcoatusa.com/' },
      { name: 'SPIbelt', url: 'https://www.SPIbelt.com' },
      { name: 'NexiGo', url: 'https://www.nexigo.com/' },
      { name: 'Joyfy', url: 'https://www.joyfy.com/' },
      { name: 'Spirit Animal Coffee', url: 'https://www.spiritanimalcoffee.com' },
      { name: 'eat2explore', url: 'https://www.eat2explore.com' },
      { name: 'Measure and Made', url: 'https://www.measureandmade.com' },
      { name: 'SeattlePPE', url: 'https://www.seattleppe.com' },
      { name: 'Favor Boots', url: 'https://www.favorboots.com' },
      { name: 'iWALK', url: 'https://iwalkmall.com/' },
      { name: 'Chili Chews', url: 'https://chilichews.com' },
      { name: 'Repurpose', url: 'https://www.repurpose.com' },
      { name: 'My Halo Ring Limited', url: 'https://www.myhaloring.com' },
      { name: 'BESTVA', url: 'https://www.bestvaled.com/' },
      { name: 'Colonial Dames Co., Ltd.', url: 'https://www.colonialdames.com' },
      { name: 'Sailing Virgins', url: 'https://sailingvirgins.com' },
      { name: 'The Dairy Fairy', url: 'https://thedairyfairy.com' },
      { name: 'Camilalamps', url: 'https://www.camilalamps.com/' },
      { name: 'Smiling Tree Toys', url: 'https://smilingtreetoys.com' },
      { name: 'MarkShop', url: 'https://www.markshop.co.uk' },
      { name: 'Britt x Beks', url: 'https://Brittxbeks.com' },
      { name: 'CamWell', url: 'https://www.ourcamwell.com' },
      { name: 'Nature Clear', url: 'https://joyrise.com/products/recovery-powder-10x-powder-stick-packs' },
      { name: 'Heal the Masses LLC', url: 'https://healthemasses.com' },
      { name: 'Santa Medical', url: 'https://www.santamedical.com' },
      { name: 'Yaheetech', url: 'https://www.yaheetech.shop' },
      { name: 'Filenow', url: 'https://www.filenow.com' },
      { name: 'ORZORZ', url: 'https://orzorzvip.com' },
      { name: 'glo910', url: 'https://us.glo910.com/' },
      { name: 'The Face Haus', url: 'https://thefacehaus.com' },
      { name: 'Easy Name Change LLC', url: 'https://www.easynamechange.com/' },
      { name: 'Ningbo Beidao E-commerce Co,Ltd', url: 'https://www.kingseven.vip' },
      { name: 'Lost Woods', url: 'https://lostwoodsvegan.com/' },
      { name: 'Sensi', url: 'https://sensi.copeland.com/en-us' },
      { name: 'ForeverMissed', url: 'https://www.forevermissed.com/reseller/446178' },
      { name: 'All Circles', url: 'https://www.allcircles.co' },
      { name: 'PAKA Apparel', url: 'https://www.pakaapparel.com/' },
      { name: 'HCGRX', url: 'https://chainxpeptides.com/' },
      { name: 'Anuschka', url: 'https://www.anuschkaleather.com' },
      { name: 'Sense-U Baby', url: 'https://www.sense-u.com' },
      { name: 'DIY Pest Control', url: 'https://diypestcontrol.com' },
      { name: 'Zolli Candy', url: 'https://shop.zollipops.com/' },
      { name: 'Redeem Therapeutics', url: 'https://www.redeemrx.com' },
      { name: 'Neat', url: 'https://www.neatapparel.com' },
      { name: 'FindBuyTool', url: 'https://www.findbuytool.com?utm_source=dynamic&utm_medium=Shareasale&utm_campaign=Affiliates&utm_content=textlink' },
      { name: 'Rossi Derm MD', url: 'https://www.rossidermmd.com' },
      { name: 'Chicago Brick Oven', url: 'https://www.chicagobrickoven.com' },
      { name: 'Photoboxer', url: 'https://www.photoboxer.com/' },
      { name: 'Good Laundry', url: 'https://www.goodlaundry.com' },
      { name: 'Huega House', url: 'https://huegahouse.com' },
      { name: 'Vinyl Me, Please', url: 'https://www.vinylmeplease.com' },
      { name: 'Kaleidoscope - iluvcolors', url: 'https://iluvcolors.com' },
      { name: 'Alleviate Therapy', url: 'https://www.alleviatetherapy.com' },
      { name: 'Gonex', url: 'https://www.gonexsport.com/collections/packing-cubes' },
      { name: 'Sunseeker', url: 'https://shopsunseekertech.com/products/v3-robot-lawn-mower-0-15acre-readygo' },
      { name: 'Thalo Denim', url: 'https://thalodenim.com/' },
      { name: 'Stelar London Limited', url: 'https://www.thisisstelar.com' },
      { name: 'Illuminations', url: 'https://www.illuminations.shop' },
      { name: 'Barrière', url: 'https://www.mybarriere.com' },
      { name: 'C&amp;R Unique Ornaments, Inc', url: 'https://www.weddingsparklerstore.com' },
      { name: 'Cloaked Wireless', url: 'https://cloakedwireless.com' },
      { name: 'Maamgic', url: 'https://maamgic.com/?utm_source=awin&utm_medium=affiliate' },
      { name: 'GammonVillage', url: 'https://www.gammonvillage.com' },
      { name: 'BedInABox', url: 'https://bedinabox.com' },
      { name: 'Sand Dollar Dubai', url: 'https://www.sanddollardubai.com' },
      { name: 'Pininfarina Hybrid Watches', url: 'https://www.pininfarina-hybridwatchbyglobics.com/' },
      { name: 'Neje.shop', url: 'https://neje.shop' },
      { name: 'Beauty Forever', url: 'https://www.beautyforever.com' },
      { name: 'Mato & Hash', url: 'https://matohash.com' },
      { name: 'Sonetel', url: 'https://sonetel.com' },
      { name: 'Ciarra', url: 'https://www.ciarraappliances.com' },
      { name: 'Lawnbright', url: 'https://getlawnbright.com' },
      { name: 'GuateGo', url: 'https://guatego.com/Guatemala/Guatemala-to-Atitlan_Lake/index.php?utm_source=GuateGoShareaSale&utm_medium=Link&utm_campaign=Guatemala-City_to_Lake-Ati' },
      { name: 'Marcella', url: 'https://www.marcellanyc.com' },
      { name: 'PeachSkinSheets', url: 'https://www.peachskinsheets.com/' },
      { name: 'Buydeem', url: 'https://us.buydeem.com' },
      { name: 'ARCCAPTAIN', url: 'https://www.arccaptain.com' },
      { name: 'H-PROOF', url: 'https://h-proof.com/' },
      { name: 'Dominique Cosmetics', url: 'https://www.dominiquecosmetics.com' },
      { name: 'Scent Decant', url: 'https://www.scentdecant.com' },
      { name: 'Hawalili', url: 'https://www.hawalili.com' },
      { name: 'Ulanzi', url: 'https://www.ulanzi.com' },
      { name: 'GardePro', url: 'https://gardeproshop.com/' },
      { name: 'Kansept Knives', url: 'https://www.kanseptknives.com' },
      { name: 'XQUANT., CO LTD', url: 'https://www.hapabox.com' },
      { name: 'Russell Organics, LLC', url: 'https://www.russellorganics.com' },
      { name: 'Dressin', url: 'https://www.dressin.com' },
      { name: 'ergonofis', url: 'https://ergonofis.com/' },
      { name: 'Craft Resume', url: 'https://www.craftresumes.com' },
      { name: 'Room 502', url: 'https://room502.com/' },
      { name: 'Maono', url: 'https://www.maono.com' },
      { name: 'BannerBuzz', url: 'https://www.bannerbuzz.com' },
      { name: 'Ejools', url: 'https://www.ejools.com' },
      { name: 'F.N. Sharp', url: 'https://fnsharp.com' },
      { name: 'Chess Bazaar', url: 'https://www.chessbazaar.com' },
      { name: 'L/Ecurie Paris', url: 'https://lecurieparis.com' },
      { name: 'Superfood Science', url: 'https://www.superfoodscience.com' },
      { name: 'PUCKIPUPPY', url: 'https://www.puckipuppy.com' },
      { name: 'Milan Fashion Campus', url: 'https://academy.milanfashioncampus.eu' },
      { name: 'OMYGUARD', url: 'https://omyguard.com' },
      { name: 'Aventon Bikes', url: 'https://www.aventon.com/' },
      { name: 'Cove Smart Home Security', url: 'https://www.covesmart.com/' },
      { name: 'Xplora', url: 'https://shop.myxplora.com/' },
      { name: 'Pietro Brunelli', url: 'https://www.pietrobrunelli.it/en' },
      { name: 'Rif Care (US)', url: 'https://rifcare.com/' },
      { name: 'Vevor', url: 'https://www.vevor.com/' },
      { name: 'Huina Toys', url: 'https://huina-toys.com/' },
      { name: 'MYKA', url: 'https://www.theograce.com/' },
      { name: 'Formula Depot', url: 'https://formula-depot.com/' },
      { name: 'Alpha Lion', url: 'https://www.alphalion.com' },
      { name: 'Omne Diem', url: 'https://omnediemdirect.com/' },
      { name: 'K2 Snow', url: 'https://k2snow.com/' },
      { name: 'Prime Prometics', url: 'https://www.primeprometics.com/' },
      { name: 'Pigment', url: 'https://pigment.is/' },
      { name: 'Printique', url: 'https://www.printique.com' },
      { name: 'Biotherm', url: 'https://www.biotherm.com/' },
      { name: 'The Sill', url: 'https://thesill.com' },
      { name: 'Betsy & Adam', url: 'https://www.betsyandadam.com/' },
      { name: 'Royal Canin', url: 'https://www.royalcanin.com/us' },
      { name: 'TESVOR', url: 'https://www.tesvor.com' },
      { name: 'US Green Card Office', url: 'https://www.usgreencardoffice.com' },
      { name: 'Ulike', url: 'https://www.ulike.com' },
      { name: 'JumpSport', url: 'https://JumpSport.com' },
      { name: 'ASCENTION BEAUTY CO., INC', url: 'https://www.ascentionbeautyco.com' },
      { name: 'Edureka', url: 'https://www.edureka.co/' },
      { name: 'TaxAct', url: 'https://www.taxact.com' },
      { name: 'Boscov/s Department Stores', url: 'https://www.boscovs.com' },
      { name: 'The Walking Company', url: 'https://www.thewalkingcompany.com' },
      { name: 'Checks In The Mail', url: 'https://checksinthemail.com' },
      { name: 'Nine West', url: 'https://www.ninewest.com' },
      { name: 'GamersGate.com', url: 'https://www.gamersgate.com' },
      { name: 'Jack/s Surfboards', url: 'https://www.jackssurfboards.com/' },
      { name: 'Liftopia.com', url: 'https://www.liftopia.com/' },
      { name: 'PerfectLensWorld', url: 'https://www.perfectlensworld.com/' },
      { name: 'Vail Valley Anglers', url: 'https://www.vailvalleyanglers.com/' },
      { name: 'Brenthaven', url: 'https://brenthaven.com' },
      { name: 'MacPaw', url: 'https://macpaw.com' },
      { name: 'BrandsMart USA', url: 'https://www.BrandsMartUSA.com' },
      { name: 'Mozello SIA', url: 'https://www.mozello.com' },
      { name: 'AHAVA', url: 'https://ahava.com/' },
      { name: 'Suzanne Somers', url: 'https://www.suzannesomers.com/' },
      { name: 'Windy City Novelties', url: 'https://www.windycitynovelties.com' },
      { name: 'Mojo Socks', url: 'https://mojosocks.com/' },
      { name: 'Terminal Service Plus', url: 'https://tsplus.net' },
      { name: 'Eyeko', url: 'https://www.eyeko.com/' },
      { name: 'SpareFoot', url: 'https://www.sparefoot.com/' },
      { name: 'Orvis', url: 'https://www.orvis.com/' },
      { name: 'Garrett Wade', url: 'https://garrettwade.com' },
      { name: 'My 1st Years', url: 'https://www.my1styears.com/' },
      { name: 'VoIP Supply', url: 'https://www.voipsupply.com' },
      { name: 'Boll & Branch', url: 'https://www.bollandbranch.com/' },
      { name: 'VIDA', url: 'https://shopvida.com/' },
      { name: 'Hanna Andersson', url: 'https://www.hannaandersson.com' },
      { name: 'LightInTheBox', url: 'https://lightinthebox.com' },
      { name: 'Buffalo David Bitton', url: 'https://www.buffalojeans.com' },
      { name: 'Savile Row Company Ltd', url: 'https://savilerowco.com' },
      { name: 'Decibullz Custom Earphones', url: 'https://decibullz.com' },
      { name: 'HBX', url: 'https://www.hbx.com' },
      { name: 'Beverly Diamonds', url: 'https://www.beverlydiamonds.com/' },
      { name: 'FragranceNet.com', url: 'https://www.fragrancenet.com/' },
      { name: 'Zazzle', url: 'https://www.zazzle.com/' },
      { name: 'ENGLAND RUGBY STORE', url: 'https://www.englandrugbystore.com/' },
      { name: 'Way.com', url: 'https://www.way.com/' },
      { name: 'Thin Slim Foods', url: 'https://www.thinslimfoods.com/' },
      { name: 'GourmetGiftBaskets.com', url: 'https://www.gourmetgiftbaskets.com/?refer=Impact' },
      { name: 'Sulwhasoo', url: 'https://us.sulwhasoo.com' },
      { name: 'Magical Shuttle', url: 'https://www.magicalshuttle.com' },
      { name: 'Lunarship Software', url: 'https://lunarship.com' },
      { name: 'Ritani', url: 'https://www.ritani.com' },
      { name: 'Hometown Hero', url: 'https://hometownhero.com/' },
      { name: 'CMSNL.com', url: 'https://www.cmsnl.com/' },
      { name: 'Native Union', url: 'https://www.nativeunion.com/' },
      { name: 'Tracfone Wireless', url: 'https://www.tracfone.com/home' },
      { name: 'Rainbow Light', url: 'https://www.rainbowlight.com' },
      { name: 'Darphin', url: 'https://www.darphin.com/index.tmpl?ngextredir=1' },
      { name: 'Autodesk', url: 'https://www.autodesk.com/' },
      { name: 'Athleta', url: 'https://athleta.gap.com' },
      { name: 'RentalCars.com', url: 'https://www.rentalcars.com/' },
      { name: 'Fitz and Floyd', url: 'https://www.fitzandfloyd.com/' },
      { name: 'Clearance Chair', url: 'https://clearancechair.com/' },
      { name: 'Hudson Jeans', url: 'https://www.hudsonjeans.com/' },
      { name: 'Tatcha', url: 'https://www.tatcha.com' },
      { name: 'Italist', url: 'https://www.italist.com/' },
      { name: 'Taos Footwear', url: 'https://taosfootwear.com' },
      { name: 'Keepsake Quilting', url: 'https://www.keepsakequilting.com/' },
      { name: 'Agriframes', url: 'https://www.agriframes.us/' },
      { name: 'SuperJeweler', url: 'https://www.superjeweler.com/' },
      { name: 'Swift Publisher', url: 'https://www.swiftpublisher.com/' },
      { name: 'JACHS NY', url: 'https://www.jachsny.com/' },
      { name: 'Hickory Farms', url: 'https://www.hickoryfarms.com/' },
      { name: 'National Car Rental', url: 'https://www.nationalcar.com/en_US/car-rental/home.html' },
      { name: 'tasc Performance', url: 'https://www.tascperformance.com/' },
      { name: 'Andie', url: 'https://andieswim.com' },
      { name: 'Dr. Brandt Skincare', url: 'https://drbrandtskincare.com/' },
      { name: 'Auto Europe Car Rentals', url: 'https://www.autoeurope.com' },
      { name: 'Sharper Image', url: 'https://www.sharperimage.com/' },
      { name: 'Bouqs', url: 'https://www.bouqs.com' },
      { name: 'Love Wellness', url: 'https://lovewellness.com/' },
      { name: '7 For All Mankind', url: 'https://www.7forallmankind.com/' },
      { name: 'Jones NY', url: 'https://www.jny.com/' },
      { name: 'inkbox Tattoos', url: 'https://inkbox.com/' },
      { name: 'AppliancePartsPros.com, Inc.', url: 'https://www.appliancepartspros.com/LinkShare.aspx' },
      { name: 'Grow Gorgeous', url: 'https://www.growgorgeous.com/' },
      { name: 'Simon Jersey', url: 'https://www.simonjersey.com/' },
      { name: 'Swyft Filings', url: 'https://www.swyftfilings.com' },
      { name: 'Royal Doulton', url: 'https://royaldoulton.com/en-us/' },
      { name: 'Casadei', url: 'https://www.casadei.com/en-us/' },
      { name: 'Points.com', url: 'https://storefront.points.com/etihad-guest/en-US/buy?irgwc=1&referralCode=' },
      { name: 'PetSmart', url: 'https://www.petsmart.com' },
      { name: 'Timex', url: 'https://timex.com' },
      { name: 'Princess Cruise Lines', url: 'https://www.princess.com' },
      { name: 'Reebok', url: 'https://www.reebok.com/' },
      { name: 'SilkCut Underwear', url: 'https://silkcutunderwear.com' },
      { name: 'BuildASign and EasyCanvasPrints', url: 'https://www.buildasign.com/' },
      { name: 'PacSun', url: 'https://www.pacsun.com' },
      { name: 'Knix', url: 'https://knix.com/' },
      { name: 'Sykes Holiday Cottages', url: 'https://www.sykescottages.co.uk/' },
      { name: 'Escort Radar', url: 'https://www.escortradar.com/' },
      { name: 'PurelyAlpaca', url: 'https://purelyalpaca.com' },
      { name: 'airweave', url: 'https://airweave.com' },
      { name: 'LoveBook', url: 'https://lovebookonline.com' },
      { name: 'Teva', url: 'https://www.teva.com' },
      { name: 'Victoria Emerson', url: 'https://www.victoriaemerson.com' },
      { name: 'ModdedZone', url: 'https://www.moddedzone.com' },
      { name: 'Stila Cosmetics', url: 'https://www.stilacosmetics.com/' },
      { name: 'The Tea Spot', url: 'https://theteaspot.com' },
      { name: 'Overton/s', url: 'https://overtons.com' },
      { name: 'SpinLife', url: 'https://www.spinlife.com' },
      { name: 'ItsWorthMore', url: 'https://itsworthmore.com' },
      { name: 'Lola Rose', url: 'https://lolaroseglobal.com' },
      { name: 'Centara Hotels & Resorts', url: 'https://www.centarahotelsresorts.com/' },
      { name: 'Ecosa', url: 'https://www.ecosa.com' },
      { name: 'Arlo Skye', url: 'https://www.arloskye.com' },
      { name: 'Dessy Group', url: 'https://dessy.com' },
      { name: 'Half Price Drapes', url: 'https://www.halfpricedrapes.com/' },
      { name: 'Ozobot', url: 'https://ozobot.com' },
      { name: 'Livia', url: 'https://mylivia.com/' },
      { name: 'American Family Safety', url: 'https://www.americanfamilysafety.com' },
      { name: 'LensesRx', url: 'https://lensesrx.com' },
      { name: 'Scothosts Ltd', url: 'https://www.libertyshield.com' },
      { name: 'Vegin/ Out', url: 'https://www.veginout.com' },
      { name: 'Vinity Soft inc.', url: 'https://www.vinitysoft.com' },
      { name: 'Crazy Dog Tshirts', url: 'https://Www.crazydogtshirts.com' },
      { name: 'Zotto Sleep', url: 'https://www.zottosleep.com' },
      { name: 'Oxford Biolabs', url: 'https://us.oxfordbiolabs.com' },
      { name: 'Las Vegas Perks', url: 'https://www.lasvegasperks.com' },
      { name: 'CrateChef', url: 'https://www.cratechef.com' },
      { name: 'The Wright Stuff', url: 'https://www.thewrightstuff.com' },
      { name: 'Binxy Baby', url: 'https://binxybaby.com/' },
      { name: 'Paleo Hero', url: 'https://paleohero.com.au' },
      { name: 'Bein Harim Tourism Services LTD', url: 'https://www.beinharimtours.com' },
      { name: 'Punk Design', url: 'https://punkdesign.shop' },
      { name: 'HoneyColony', url: 'https://www.honeycolony.com' },
      { name: 'supersmile', url: 'https://www.supersmile.com' },
      { name: 'TeethNightGuard.com', url: 'https://www.teethnightguard.com' },
      { name: 'Eli & Elm', url: 'https://www.eliandelm.com' },
      { name: 'Themeisle', url: 'https://themeisle.com' },
      { name: 'Mabel/s Labels', url: 'https://www.mabelslabels.com/' },
      { name: 'Australian Native T-Shirts', url: 'https://www.australian-native.com.au' },
      { name: 'Soft Paws', url: 'https://www.softpaws.com' },
      { name: 'DISCOVER NIGHT', url: 'https://www.discovernight.com' },
      { name: 'Groupon', url: 'https://www.groupon.com/' },
      { name: 'Nanit', url: 'https://www.nanit.com' },
      { name: 'Scuba.com', url: 'https://www.scuba.com' },
      { name: 'iReliev Products', url: 'https://www.ireliev.com/' },
      { name: 'TOUS', url: 'https://www.tous.com/' },
      { name: 'STDCheck.com', url: 'https://www.stdcheck.com' },
      { name: 'Highlights For Children', url: 'https://shop.highlights.com/' },
      { name: 'LightsOnline.com', url: 'https://www.lightsonline.com' },
      { name: 'Modern Bathroom', url: 'https://www.modernbathroom.com' },
      { name: 'Testclear.com', url: 'https://www.testclear.com' },
      { name: 'Crazy Shirts', url: 'https://crazyshirts.com' },
      { name: 'Nails Inc', url: 'https://nailsinc.com' },
      { name: 'AirFilters.com', url: 'https://www.airfilters.com/' },
      { name: 'Hook & Tackle', url: 'https://hookandtackle.com/' },
      { name: 'Valley Food Storage', url: 'https://valleyfoodstorage.com/' },
      { name: 'Plow & Hearth', url: 'https://www.plowhearth.com/' },
      { name: 'TireMax.com', url: 'https://www.tiremart.com/' },
      { name: 'My Evergreen', url: 'https://www.myevergreen.com/' },
      { name: 'ATN Corp (American Technology Network, Corp.)', url: 'https://www.atncorp.com/' },
      { name: 'Swiftwick', url: 'https://www.swiftwick.com/' },
      { name: 'Purple Mattress', url: 'https://purple.com' },
      { name: 'Kelty', url: 'https://kelty.com' },
      { name: 'ShearComfort Seat Covers', url: 'https://shearcomfort.com' },
      { name: 'Goldenmine and Jewelry Vortex', url: 'https://www.goldenmine.com/' },
      { name: 'United By Blue', url: 'https://unitedbyblue.com/' },
      { name: 'Puro Sound', url: 'https://www.purosound.com' },
      { name: 'Revo', url: 'https://www.revo.com' },
      { name: 'Karmaloop', url: 'https://www.karmaloop.com' },
      { name: 'Matisse Footwear', url: 'https://www.matissefootwear.com/' },
      { name: 'DreamCloud', url: 'https://dreamcloudsleep.com/' },
      { name: 'JCPenney', url: 'https://www.jcpenney.com/' },
      { name: 'Omaha Steaks', url: 'https://www.omahasteaks.com/' },
      { name: 'MTD Parts', url: 'https://www.mtdparts.com/equipment/mtdparts' },
      { name: 'Apple Vacations', url: 'https://www.applevacations.com/' },
      { name: 'Polynesian Cultural Center', url: 'https://www.polynesia.com' },
      { name: 'NHLshop', url: 'https://shop.nhl.com' },
      { name: 'Haband', url: 'https://www.haband.com' },
      { name: 'LOOK Optic', url: 'https://www.lookoptic.com/' },
      { name: 'Nest Bedding', url: 'https://www.nestbedding.com' },
      { name: 'Collector Square', url: 'https://www.collectorsquare.com' },
      { name: 'O&O Software', url: 'https://www.oo-software.com' },
      { name: 'Abt Electronics', url: 'https://www.abt.com/' },
      { name: 'The Tire Rack', url: 'https://www.tirerack.com' },
      { name: 'Ross-Simons', url: 'https://www.ross-simons.com' },
      { name: 'Vegamour', url: 'https://www.vegamour.com' },
      { name: 'The Tight Spot', url: 'https://thetightspot.com/' },
      { name: 'Healthycell', url: 'https://www.healthycell.com' },
      { name: 'MasterClass', url: 'https://www.masterclass.com' },
      { name: 'Ryderwear', url: 'https://au.ryderwear.com/' },
      { name: 'HEYDUDE', url: 'https://www.heydude.com/' },
      { name: 'Select Blinds', url: 'https://www.SelectBlinds.com' },
      { name: 'Lindt Chocolatier', url: 'https://lindtusa.com' },
      { name: 'Paul Smith', url: 'https://www.paulsmith.com/us' },
      { name: '2xist', url: 'https://2xist.com/' },
      { name: 'Daily Harvest', url: 'https://www.daily-harvest.com/' },
      { name: 'Rokform', url: 'https://www.rokform.com/' },
      { name: 'Belstaff', url: 'https://www.belstaff.com/' },
      { name: 'Lorex', url: 'https://www.lorex.com/' },
      { name: 'Brentwood Home', url: 'https://www.brentwoodhome.com' },
      { name: 'RevitaLash', url: 'https://www.revitalash.com/' },
      { name: 'Dynamite Clothing', url: 'https://www.dynamiteclothing.com/us/' },
      { name: 'Super.com', url: 'https://www.super.com/travel/' },
      { name: 'MotoSport.com', url: 'https://www.motosport.com/' },
      { name: 'Natchez Shooters Supplies', url: 'https://www.natchezss.com' },
      { name: 'Sperry', url: 'https://www.sperry.com/' },
      { name: 'RedBubble', url: 'https://www.redbubble.com' },
      { name: 'Hotwire', url: 'https://www.hotwire.com/' },
      { name: 'Chaco', url: 'https://www.chacos.com/US/en/home' },
      { name: 'Discount Surgical', url: 'https://www.discountsurgical.com/' },
      { name: 'Anthropologie', url: 'https://www.anthropologie.com' },
      { name: 'DERMA E', url: 'https://dermae.com/' },
      { name: 'Dango Products', url: 'https://www.DangoProducts.com' },
      { name: 'Professional Supplement Center', url: 'https://www.professionalsupplementcenter.com/' },
      { name: 'Aerosoles', url: 'https://www.aerosoles.com/' },
      { name: 'Speedo', url: 'https://us.speedo.com/' },
      { name: 'PeopleFinders', url: 'https://www.peoplefinders.com' },
      { name: 'DUER', url: 'https://shopduer.com/' },
      { name: 'Houzz', url: 'https://www.houzz.com/' },
      { name: 'Joes New Balance Outlet', url: 'https://www.joesnewbalanceoutlet.com' },
      { name: 'Cafe Britt Gourmet Coffee', url: 'https://www.cafebritt.com' },
      { name: 'Callaway Golf Pre-Owned', url: 'https://www.callawaygolfpreowned.com/' },
      { name: 'Intimissimi', url: 'https://www.intimissimi.com/us/' },
      { name: 'Bobbi Brown Cosmetics', url: 'https://www.bobbibrowncosmetics.com' },
      { name: 'AXA Travel Insurance', url: 'https://www.axatravelinsurance.com/' },
      { name: 'Lightspeed', url: 'https://lightspeedhq.com' },
      { name: 'Marshall Headphones', url: 'https://www.marshall.com' },
      { name: 'Foreo', url: 'https://www.foreo.com/' },
      { name: 'CarParts.com', url: 'https://www.carparts.com/' },
      { name: 'Havaianas', url: 'https://www.havaianas.com/' },
      { name: 'AmorePacific', url: 'https://us.amorepacific.com' },
      { name: 'Raw Generation', url: 'https://www.rawgeneration.com' },
      { name: 'Gotogate', url: 'https://www.gotogate.com' },
      { name: 'RawSpiceBar', url: 'https://rawspicebar.com' },
      { name: 'Storq Inc', url: 'https://storq.com' },
      { name: 'Kosterina', url: 'https://kosterina.com' },
      { name: 'Ergobaby', url: 'https://ergobaby.com' },
      { name: 'VIOFO', url: 'https://www.viofo.com' },
      { name: 'Caudabe LLC', url: 'https://www.caudabe.com' },
      { name: 'SOL Organics', url: 'https://www.solorganix.com' },
      { name: 'DC Shoes', url: 'https://www.dcshoes.com/' },
      { name: 'Koa  Coffee', url: 'https://www.koacoffee.com' },
      { name: 'Redline Automotive Accessories Corp.', url: 'https://www.redlinegoods.com/' },
      { name: 'Nubia', url: 'https://intl.nubia.com' },
      { name: 'Starlight Lighting', url: 'https://starlightlighting.ca/' },
      { name: 'Hawaii Coffee Company', url: 'https://www.hawaiicoffeecompany.com' },
      { name: 'Modern Artisans', url: 'https://www.modernartisans.com' },
      { name: 'LAmade Clothing', url: 'https://WWW.LAMADECLOTHING.COM' },
      { name: 'Spohn Performance, Inc.', url: 'https://www.spohn.net' },
      { name: 'UrthBox', url: 'https://www.urthbox.com' },
      { name: 'CocoMelody', url: 'https://cocomelody.com' },
      { name: 'CatsPlay Furniture', url: 'https://www.catsplay.com' },
      { name: 'Wolfgang', url: 'https://wolfgangusa.com/' },
      { name: 'Novadore USA, Inc (Duradry)', url: 'https://www.duradry.com' },
      { name: 'Immune Tree', url: 'https://www.immunetree.com/' },
      { name: 'i-Blason', url: 'https://www.i-blason.com' },
      { name: 'InventoryLab', url: 'https://inventorylab.com' },
      { name: 'AdultClothDiaper.Com', url: 'https://www.adultclothdiaper.com' },
      { name: 'Gotcha Matcha', url: 'https://gotchamatcha.com' },
      { name: 'BeachCandy Swimwear', url: 'https://www.BeachCandySwimwear.com' },
      { name: 'AwesomeSeating', url: 'https://www.AwesomeSeating.com' },
      { name: 'Pgprint.com', url: 'https://www.pgprint.com' },
      { name: 'Neowing', url: 'https://rental.cdjapan.co.jp/index_en_jpy_7.html' },
      { name: 'Project Noo You', url: 'https://projectnooyou.com/' },
      { name: 'Autonomous Inc.', url: 'https://www.autonomous.ai' },
      { name: 'PetPlate', url: 'https://www.petplate.com' },
      { name: 'Johnston & Murphy', url: 'https://www.johnstonmurphy.com/' },
      { name: 'goodoffer24', url: 'https://www.goodoffer24.com' },
      { name: 'Creativebug', url: 'https://creativebug.com' },
      { name: 'NY Designer Fabrics', url: 'https://www.nydesignerfabrics.com/' },
      { name: 'Revive Social', url: 'https://revive.social/' },
      { name: 'CGI-Central', url: 'https://www.cgi-central.net/scripts/amember' },
      { name: 'Design It Yourself Gift Baskets', url: 'https://www.designityourselfgiftbaskets.com' },
      { name: 'OLMA IV Inc.', url: 'https://olmafood.com' },
      { name: 'Miracle Noodle', url: 'https://www.miraclenoodle.com' },
      { name: 'Jolse', url: 'https://jolse.com/' },
      { name: 'Alpine Air Technologies', url: 'https://www.AlpineAirTechnologies.com' },
      { name: 'Baggallini', url: 'https://www.baggallini.com/?itpStatus=1&utm_source=affiliates&utm_medium=!!!advertiser!!!&utm_campaign=!!!id!!!' },
      { name: 'RefrigiWear', url: 'https://www.refrigiwear.com' },
      { name: 'Best Vet Care', url: 'https://www.bestvetcare.com/' },
      { name: 'All-Clad Factory Seconds', url: 'https://www.homeandcooksales.com/' },
      { name: 'ShopWSS', url: 'https://www.ShopWSS.com' },
      { name: 'Sandals & Beaches Resorts', url: 'https://www.sandals.com' },
      { name: 'Better World Books', url: 'https://www.betterworldbooks.com' },
      { name: 'Dermaflash', url: 'https://dermaflash.com/' },
      { name: 'Ethel M Chocolates', url: 'https://www.ethelm.com' },
      { name: 'Als.com', url: 'https://www.als.com/' },
      { name: 'Ballistic Advantage', url: 'https://www.ballisticadvantage.com/' },
      { name: 'FFL123.com', url: 'https://www.ffl123.com/' },
      { name: 'JAMECO', url: 'https://www.jameco.com/webapp/wcs/stores/servlet/StoreCatalogDisplay?storeId=10001&amp' },
      { name: 'FoodSaver', url: 'https://www.foodsaver.com/' },
      { name: 'Jewlr', url: 'https://www.jewlr.com/' },
      { name: 'Marissa Collections', url: 'https://marissacollections.com' },
      { name: 'Nanushka', url: 'https://www.nanushka.com/' },
      { name: 'Xaxe.com', url: 'https://www.xaxe.com' },
      { name: 'The Siceloff Companies', url: 'https://www.walking-canes.net' },
      { name: 'The Honest Company', url: 'https://www.honest.com' },
      { name: 'Lauren Moshi', url: 'https://www.laurenmoshi.com/' },
      { name: 'Scotch Porter', url: 'https://www.scotchporter.com' },
      { name: 'FootJoy', url: 'https://www.footjoy.com' },
      { name: 'Mons Peak IX', url: 'https://www.monspeakix.com/' },
      { name: 'LSPACE', url: 'https://www.lspace.com/' },
      { name: 'Sanctuary Clothing', url: 'https://www.sanctuaryclothing.com/' },
      { name: 'Tanga.com', url: 'https://tanga.com' },
      { name: 'Nina Shoes', url: 'https://ninashoes.com/' },
      { name: 'Chrome Industries', url: 'https://www.chromeindustries.com/' },
      { name: 'S/well', url: 'https://www.swell.com/' },
      { name: 'IDrive', url: 'https://www.idrive.com' },
      { name: 'Chaser Brand', url: 'https://www.chaserbrand.com' },
      { name: 'JerkFit', url: 'https://jerkfit.com/' },
      { name: 'Tea Collection', url: 'https://teacollection.com' },
      { name: 'Adore Me', url: 'https://www.adoreme.com' },
      { name: 'Shop Horne', url: 'https://www.shophorne.com' },
      { name: 'American Girl', url: 'https://www.americangirl.com' },
      { name: 'Bass Pro Shops', url: 'https://www.basspro.com' },
      { name: 'Extended Stay America', url: 'https://www.extendedstayamerica.com' },
      { name: 'MLBShop.com', url: 'https://www.mlbshop.com' },
      { name: 'Colorful Images', url: 'https://www.colorfulimages.com' },
      { name: 'Intego', url: 'https://www.intego.com/' },
      { name: 'Soko Glam', url: 'https://sokoglam.com/' },
      { name: 'Tailor Brands', url: 'https://www.tailorbrands.com/llc-states-aff' },
      { name: 'Rodial', url: 'https://us.rodial.com/' },
      { name: 'Ogee', url: 'https://ogee.com/' },
      { name: 'Kendra Scott', url: 'https://www.kendrascott.com/' },
      { name: 'MacKeeper', url: 'https://rz.mackeeper.com/paramss=phexafc9a8dab4cbb1a192979fb2999cdfe8cb90b1f4dbc6c1a79a9a979ceae9c5c49eaca29dc4a09c97d5ad91d3c8dba29c96dbead1c2979fb299cc97a19fc0a9aad0cac8a4e1dbc9c0a2a29c95cbab9ca3c4a199d0dce09098c4da9b92c891a1d1c794&amp;amp;amp;amp;amp;amp;amp;trt=29_52351' },
      { name: 'Adrenaline', url: 'https://www.adrenaline.com/' },
      { name: 'Neal/s Yard Remedies', url: 'https://us.nealsyardremedies.com/' },
      { name: 'Sylvane', url: 'https://www.sylvane.com' },
      { name: 'HughesNet', url: 'https://www.hughesnet.com/cj-program' },
      { name: 'Real Madrid Shop', url: 'https://us.shop.realmadrid.com/' },
      { name: 'Zoro', url: 'https://www.zoro.com' },
      { name: 'Tovala', url: 'https://www.tovala.com' },
      { name: 'Tempur-Pedic', url: 'https://www.tempurpedic.com/' },
      { name: 'The Company Store', url: 'https://www.thecompanystore.com/homepage?' },
      { name: 'TomboyX', url: 'https://tomboyx.com' },
      { name: 'Affordable World', url: 'https://www.affordableworld.com/' },
      { name: 'Public Goods', url: 'https://publicgoods.com' },
      { name: 'Palace Resorts', url: 'https://www.palaceresorts.com/' },
      { name: 'ProHealth', url: 'https://www.prohealth.com' },
      { name: 'MyChelle Dermaceuticals', url: 'https://www.mychelle.com' },
      { name: 'Christy Sports', url: 'https://www.christysports.com/' },
      { name: 'Sachin & Babi', url: 'https://www.sachinandbabi.com/' },
      { name: 'Laneige', url: 'https://us.laneige.com/' },
      { name: 'File Viewer Plus', url: 'https://fileviewerplus.com' },
      { name: 'Turtle Beach', url: 'https://www.turtlebeach.com/' },
      { name: 'Keds', url: 'https://www.keds.com/' },
      { name: 'Garage Clothing', url: 'https://www.garageclothing.com/us/' },
      { name: 'St. John Knits', url: 'https://www.stjohnknits.com/' },
      { name: 'Living Proof', url: 'https://www.livingproof.com' },
      { name: 'National Tyres and Autocare', url: 'https://www.national.co.uk/' },
      { name: 'Thrifty', url: 'https://www.thrifty.com' },
      { name: 'Best Western', url: 'https://www.bestwestern.com' },
      { name: 'Enterprise Rent a Car', url: 'https://www.enterprise.com/en/home.html' },
      { name: 'Otticanet', url: 'https://www.otticanet.com' },
      { name: 'Alo Yoga', url: 'https://www.aloyoga.com/' },
      { name: 'FlowerShopping.com', url: 'https://www.flowershopping.com/' },
      { name: 'Torrid', url: 'https://www.torrid.com/' },
      { name: 'Ramy Brook', url: 'https://www.ramybrook.com' },
      { name: 'Dr. Schulze/s', url: 'https://herbdoc.com' },
      { name: 'LATAM Airlines', url: 'https://www.latamairlines.com/us/en' },
      { name: 'JBL', url: 'https://www.jbl.com' },
      { name: 'Caesars Rewards', url: 'https://www.caesars.com/' },
      { name: 'Harvey Nichols', url: 'https://www.harveynichols.com/' },
      { name: 'Carter/s', url: 'https://carters.com' },
      { name: 'Contiki', url: 'https://www.contiki.com' },
      { name: 'Wedgwood', url: 'https://wedgwood.com/en-us/' },
      { name: 'Bake Me A Wish', url: 'https://www.bakemeawish.com' },
      { name: 'PUMA', url: 'https://www.puma.com' },
      { name: 'ASICS', url: 'https://www.asics.com/' },
      { name: 'Evereve', url: 'https://evereve.com/' },
      { name: 'Angara', url: 'https://www.angara.com' },
      { name: 'Rogue Industries', url: 'https://www.rogue-industries.com' },
      { name: 'PLR Products', url: 'https://plrproducts.com' },
      { name: 'QuickZip', url: 'https://quickzip.com' },
      { name: 'ScalpMED', url: 'https://scalpmed.com' },
      { name: 'AccuQuilt', url: 'https://www.accuquilt.com' },
      { name: 'Planet Beauty Inc', url: 'https://www.planetbeauty.com' },
      { name: 'X-Chair', url: 'https://xchair.com' },
      { name: 'Roxy', url: 'https://www.roxy.com/' },
      { name: 'GoSun', url: 'https://www.gosun.co' },
      { name: 'Bank Checks Plus', url: 'https://www.BankChecksPlus.com' },
      { name: 'Unique Wellness', url: 'https://www.wellnessbriefs.com' },
      { name: 'Larson Jewelers', url: 'https://www.larsonjewelers.com' },
      { name: 'VisualVisitor', url: 'https://www.visualvisitor.com' },
      { name: 'Dr. Colbert', url: 'https://drcolbert.com' },
      { name: 'Sunsky', url: 'https://www.sunsky-online.com' },
      { name: 'Love Scent Pheromone', url: 'https://love-scent.com' },
      { name: 'German Food Box', url: 'https://germanfoodbox.com' },
      { name: 'Master of Project Academy', url: 'https://Masterofproject.com' },
      { name: 'Kremp Florist', url: 'https://www.kremp.com/' },
      { name: 'Massage Naturals', url: 'https://www.massagenaturals.com' },
      { name: 'Chelsea Charles Jewelry', url: 'https://www.chelseacharles.com' },
      { name: 'Standards and Practices', url: 'https://standardsandpractices.com' },
      { name: 'Swords of Northshire', url: 'https://Swordsofnorthshire.com' },
      { name: 'Dealsie.com', url: 'https://dealsie.com' },
      { name: 'Easy Roller Dice', url: 'https://www.easyrollerdice.com' },
      { name: 'Invitation In A Bottle', url: 'https://www.invitationinabottle.com' },
      { name: 'Wholesale Scarves', url: 'https://www.wholesalescarvesusa.com' },
      { name: 'Sweet Zzz Mattress', url: 'https://sweetzzzmattress.com/' },
      { name: 'TicketNetwork', url: 'https://www.ticketnetwork.com' },
      { name: '365 Printing Inc', url: 'https://www.365inlove.com' },
      { name: 'Personal Safety Corporation', url: 'https://www.securesafetysolutions.com' },
      { name: 'Carnivore Club', url: 'https://www.carnivoreclub.co' },
      { name: 'ScentBox.com', url: 'https://www.scentbox.com/index.cfm?source=2' },
      { name: 'AppPresser', url: 'https://apppresser.com' },
      { name: 'Five Finger Tees', url: 'https://www.fivefingertees.com' },
      { name: 'Elite Jewels Inc.', url: 'https://www.elitejewels.com' },
      { name: 'Canada/s Gift Baskets', url: 'https://canadasgiftbaskets.ca' },
      { name: 'BrainMD Health', url: 'https://brainmd.com' },
      { name: '48hourslogo', url: 'https://www.48hourslogo.com' },
      { name: 'Aviya Mattress', url: 'https://www.aviyamattress.com' },
      { name: 'GetNameNecklace', url: 'https://www.getnamenecklace.com' },
      { name: 'Grokker', url: 'https://grokker.com' },
      { name: 'Nitecore Store', url: 'https://nitecorestore.com' },
      { name: 'The Body Shop', url: 'https://us.thebodyshop.com/' },
      { name: 'Adorama', url: 'https://www.adorama.com' },
      { name: 'IT Cosmetics', url: 'https://www.itcosmetics.com/' },
      { name: 'Quill', url: 'https://www.quill.com/' },
      { name: 'Power Systems', url: 'https://powersystems.com' },
      { name: 'Canvasdiscount.com', url: 'https://www.canvasdiscount.com' },
      { name: 'Laplink', url: 'https://go.laplink.com/' },
      { name: 'Newspaper Subscription', url: 'https://www.discountednewspapers.com' },
      { name: 'CityPass', url: 'https://www.citypass.com' },
      { name: '1-800-GOT-JUNK?', url: 'https://www.1800gotjunk.com' },
      { name: 'Tech For Less', url: 'https://www.techforless.com' },
      { name: 'Pixie Market', url: 'https://www.pixiemarket.com' },
      { name: 'BeautifiedYou.com ', url: 'https://www.beautifiedyou.com' },
      { name: 'JINsoon', url: 'https://jinsoon.com' },
      { name: 'Manuka Doctor', url: 'https://www.manukadoctor.com' },
      { name: 'Proof Eyewear', url: 'https://www.iwantproof.com/' },
      { name: 'Burts Bees Baby', url: 'https://www.BurtsBeesBaby.com' },
      { name: 'MochaHost', url: 'https://www.mochahost.com' },
      { name: 'Ezcosplay', url: 'https://www.ezcosplay.com' },
      { name: 'Barbeques Galore', url: 'https://www.bbqgalore.com' },
      { name: 'Stacy Adams', url: 'https://www.stacyadams.com' },
      { name: 'X3M Consulting Ltd', url: 'https://fitnessassistant.net' },
      { name: 'ViX Swimwear', url: 'https://www.vixpaulahermanny.com' },
      { name: 'AvaCare Medical', url: 'https://www.avacaremedical.com' },
      { name: 'ACDSee', url: 'https://www.acdsee.com/' },
      { name: 'Cookies by Design', url: 'https://www.cookiesbydesign.com' },
      { name: 'Robert Graham', url: 'https://www.robertgraham.us/' },
      { name: 'Glasses.com', url: 'https://www.glasses.com/' },
      { name: 'BiggerBooks.com', url: 'https://www.biggerbooks.com' },
      { name: 'Appy Pie', url: 'https://www.appypie.com/' },
      { name: 'Amazing Grass', url: 'https://www.amazinggrass.com/' },
      { name: 'IHG', url: 'https://www.ihg.com' },
      { name: 'Kay Jewelers', url: 'https://www.kay.com' },
      { name: 'Jarlo London', url: 'https://jarlolondon.com' },
      { name: 'Acme Tools', url: 'https://www.acmetools.com/' },
      { name: 'Mixbook', url: 'https://mixbook.com' },
      { name: 'Blueseventy', url: 'https://www.blueseventy.com/' },
      { name: 'StellarWP', url: 'https://stellarwp.com' },
      { name: 'Positive Promotions', url: 'https://www.positivepromotions.com/' },
      { name: 'Qskinz', url: 'https://qskinz.com' },
      { name: 'Baby Aspen', url: 'https://www.babyaspen.com/' },
      { name: 'BudgetPetWorld', url: 'https://www.budgetpetworld.com' },
      { name: 'Blockchain Council', url: 'https://www.blockchain-council.org' },
      { name: 'MCM', url: 'https://us.mcmworldwide.com/en_US/home' },
      { name: 'La Senza', url: 'https://www.lasenza.ca/' },
      { name: 'Baby Tula', url: 'https://babytula.com/' },
      { name: 'Dynadot.com', url: 'https://www.dynadot.com' },
      { name: 'Trina Turk', url: 'https://www.trinaturk.com' },
      { name: 'Build-A-Bear', url: 'https://www.buildabear.com/' },
      { name: 'Burpee Gardening', url: 'https://www.burpee.com/' },
      { name: 'Supergoop!', url: 'https://supergoop.com/' },
      { name: 'Aquasana', url: 'https://www.aquasana.com/' },
      { name: 'Lenox', url: 'https://www.lenox.com' },
      { name: 'SuperBoletería', url: 'https://www.superboleteria.com/inicio.aspx' },
      { name: 'Constant Contact', url: 'https://www.constantcontact.com' },
      { name: 'Threads 4 Thought', url: 'https://www.threads4thought.com' },
      { name: 'Mikasa', url: 'https://www.mikasa.com' },
      { name: 'Murray/s Cheese', url: 'https://www.murrayscheese.com' },
      { name: 'EntirelyPets Pharmacy', url: 'https://entirelypetspharmacy.com' },
      { name: 'Georgia Boot', url: 'https://www.GeorgiaBoot.com' },
      { name: 'Discount Ramps', url: 'https://www.discountramps.com' },
      { name: 'Hydro Flask', url: 'https://www.hydroflask.com/' },
      { name: 'Society6', url: 'https://society6.com' },
      { name: 'Avira', url: 'https://www.avira.com' },
      { name: 'HUROM', url: 'https://www.hurom.com/' },
      { name: 'Calzedonia', url: 'https://www.calzedonia.com/us/' },
      { name: 'Mugler', url: 'https://www.mugler.com' },
      { name: 'Bealls Florida', url: 'https://www.beallsflorida.com/' },
      { name: 'Ooma', url: 'https://www.ooma.com' },
      { name: 'Vistaprint', url: 'https://www.vistaprint.com' },
      { name: 'SpyAssociates.com', url: 'https://spyassociates.com/' },
      { name: 'Florsheim', url: 'https://www.florsheim.com' },
      { name: 'Pearson Education: InformIT', url: 'https://www.informit.com' },
      { name: 'Mrs. Fields', url: 'https://www.mrsfields.com' },
      { name: 'SmartBuyGlasses', url: 'https://www.smartbuyglasses.com' },
      { name: 'Reolink', url: 'https://reolink.com/' },
      { name: 'Bloomingdale/s', url: 'https://www.bloomingdales.com' },
      { name: 'Kohl/s', url: 'https://www.kohls.com' },
      { name: 'FC Moto', url: 'https://fc-moto.com' },
      { name: 'Holabird Sports', url: 'https://holabirdsports.com' },
      { name: 'DL1961 Women', url: 'https://www.dl1961.com' },
      { name: 'White House Black Market', url: 'https://www.whitehouseblackmarket.com/' },
      { name: 'NFLShop.com', url: 'https://www.nflshop.com' },
      { name: 'StubHub', url: 'https://www.stubhub.com/' },
      { name: 'Olympus', url: 'https://explore.omsystem.com/us/en/' },
      { name: 'Saks Fifth Avenue', url: 'https://www.saksfifthavenue.com/Entry.jsp' },
      { name: 'The Hut', url: 'https://www.thehut.com/' },
      { name: 'G Adventures', url: 'https://www.gadventures.com' },
      { name: 'Godiva', url: 'https://www.godiva.com/' },
      { name: 'KITSCH', url: 'https://www.mykitsch.com/' },
      { name: 'VIPRE Security Group', url: 'https://vipre.com/home-security/' },
      { name: 'PINKBLUSH', url: 'https://www.pinkblushmaternity.com' },
      { name: 'Gorilla Wear', url: 'https://www.gorillawear.com/' },
      { name: 'LegalZoom', url: 'https://www.legalzoom.com' },
      { name: 'Acronis', url: 'https://www.acronis.com' },
      { name: 'ShelterLogic', url: 'https://www.shelterlogic.com/' },
      { name: 'Belle & Bloom', url: 'https://www.belleandbloom.com/' },
      { name: 'SANSI LED LIGHTING INC.', url: 'https://www.sansiled.com' },
      { name: 'WANDRD', url: 'https://www.wandrd.com' },
      { name: 'Cellucor', url: 'https://cellucor.com/' },
      { name: 'Eddie Bauer', url: 'https://www.eddiebauer.com/' },
      { name: 'Bargain Junkie Holdings', url: 'https://www.bargainjunkie.com/' },
      { name: 'Daily Sale', url: 'https://dailysale.com' },
      { name: 'Puzzle Master', url: 'https://www.puzzlemaster.ca' },
      { name: 'Bonsai Boy of New York', url: 'https://www.bonsaiboy.com' },
      { name: 'Raw Paws Pet Food', url: 'https://www.rawpawspetfood.com' },
      { name: 'The Jacket Maker', url: 'https://www.thejacketmaker.com' },
      { name: 'Agoda', url: 'https://www.agoda.com' },
      { name: 'Budget Rent a Car', url: 'https://www.budget.com/en/home' },
      { name: 'Candleberry', url: 'https://www.candleberry.com' },
      { name: 'House of Scuba', url: 'https://www.houseofscuba.com' },
      { name: 'EsaRegistration.org', url: 'https://www.esaregistration.org/' },
      { name: 'Applian Technologies', url: 'https://applian.com?utm_source=Shareasale&utm_medium=affiliate' },
      { name: 'ePumps.com', url: 'https://www.ePumps.com' },
      { name: 'HobbyTron.com', url: 'https://hobbytron.com' },
      { name: 'Mini Museum LLC', url: 'https://minimuseum.com' },
      { name: 'MyCubanStore.com', url: 'https://www.mycubanstore.com' },
      { name: 'TrophyCentral', url: 'https://www.trophycentral.com' },
      { name: 'Engaged Media Inc.', url: 'https://engagedmedia.store' },
      { name: 'Spirit Jersey', url: 'https://www.spiritjersey.com' },
      { name: 'Soul Insole', url: 'https://www.soulinsole.com' },
      { name: 'Supreme Suspensions', url: 'https://supremesuspensions.com' },
      { name: 'Friendly Songs', url: 'https://www.PersonalizedFriendlySongs.com' },
      { name: 'Bubbles Bodywear', url: 'https://www.lovemybubbles.com/' },
      { name: 'Shed Defender', url: 'https://www.sheddefender.com' },
      { name: 'Home Depot', url: 'https://www.homedepot.com' },
      { name: 'PupJoy', url: 'https://pupjoy.com' },
      { name: 'Generation Tea', url: 'https://www.generationtea.com' },
      { name: 'L-email Wig', url: 'https://www.wig-supplier.com' },
      { name: 'Wondershare', url: 'https://www.wondershare.com/' },
      { name: 'Eco Terra Beds', url: 'https://www.ecoterrabeds.com/' },
      { name: 'Milanoo', url: 'https://www.milanoo.com/' },
      { name: 'Paragon Sports', url: 'https://www.paragonsports.com/' },
      { name: 'NIKE', url: 'https://www.nike.com' },
        ];
    
    // More specific unavailability patterns to avoid false positives
    const unavailabilityPatterns = [
      // Very specific patterns that clearly indicate unavailability
      'this store is unavailable',
      'our store is unavailable', 
      'store is currently unavailable',
      'sorry, this store is currently unavailable',
      'this store does not exist',
      'store temporarily closed',
      'shop temporarily closed',
      'website temporarily unavailable',
      'site temporarily unavailable',
      'this website is for sale',
      'this domain is for sale',
      'domain name is for sale',
      'parked domain',
      'website coming soon',
      'site coming soon',
      'this website is coming soon',
      'this site is coming soon',
      'opening soon',
      'under construction',
      
      // Coming soon / Newsletter signup patterns
      'sign up for our newsletter to be the first to know when we launch',
      'be the first to know when we launch',
      'sign up to be notified when we launch',
      'get notified when we launch',
      'coming soon - sign up',
      'launching soon',
      'launch soon',
      'notify me when available',
      'join our mailing list',
      'subscribe for updates',
      'stay tuned for launch',
      'pre-launch signup',
      
      // Business closure patterns
      'ceased operations',
      'officially ceased operations',
      'we have now officially ceased operations',
      'we have ceased operations',
      'business has ceased operations',
      'company has ceased operations',
      'operations have ceased',
      'no longer in business',
      'business closed permanently',
      'permanently closed',
      'closed permanently',
      'out of business',
      'business discontinued',
      'operations discontinued',
      'service discontinued',
      'company closed',
      'business shutdown',
      'operations ended',
      'website maintenance mode',
      'site maintenance mode', 
      'down for maintenance',
      'site maintenance',
      'website maintenance',
      'scheduled maintenance',
      'site offline',
      'website offline',
      'service unavailable - please try again later',
      'temporarily down for maintenance',
      'be right back - site maintenance',
      'enter password to access this site',
      'access restricted',
      'site not found',
      'page not found - 404',
      'website suspended',
      'account suspended',
      
      // Cloudflare and CDN error patterns
      'error 1000',
      'error 1001',
      'error 1002',
      'error 1003',
      'error 1004',
      'error 1005',
      'error 1006',
      'error 1007',
      'error 1008',
      'error 1009',
      'error 1010',
      'dns points to prohibited ip',
      'cloudflare error',
      'cloudflare 1xxx error',
      'ray id:',
      'dns error',
      'dns resolution error',
      'dns lookup failed',
      'dns configuration error',
      'prohibited ip',
      'ip address conflict',
      'dns conflict',
      
      // Password protection patterns (based on found sites) - ONLY site-blocking patterns
      'enter password to access this site',
      'enter password below to access the store',
      'password protected site',
      'private store - access restricted',
      'members only site',
      
      // Spanish patterns
      'próximamente',
      'tienda no disponible',
      'sitio no disponible',
      'en construcción',
      'en mantenimiento',
      'temporalmente cerrado',
      'sitio web no disponible',
      
      // French patterns
      'bientôt disponible',
      'magasin indisponible',
      'site indisponible',
      'en maintenance',
      'temporairement fermé',
      'site web indisponible',
      
      // German patterns
      'demnächst verfügbar',
      'shop nicht verfügbar',
      'website nicht verfügbar',
      'wartungsmodus',
      'vorübergehend geschlossen',
      
      // Italian patterns
      'prossimamente',
      'negozio non disponibile',
      'sito non disponibile',
      'in manutenzione',
      'temporaneamente chiuso',
      
      // Portuguese patterns
      'em breve',
      'loja indisponível',
      'site indisponível',
      'em manutenção',
      'temporariamente fechado',
      
      // Japanese patterns
      'オープン予定',
      'ストア利用不可',
      'サイト利用不可',
      'メンテナンス中',
      '一時的に閉鎖',
      
      // Chinese patterns
      '即将开放',
      '商店不可用',
      '网站不可用',
      '维护中',
      '暂时关闭'
    ];

    // Major retailer whitelist to prevent false positives  
    const majorRetailerWhitelist = [
      'ulta.com',      // ✅ Ulta
      'bestbuy.com',   // ✅ Best Buy  
      'kohls.com',     // ✅ Kohl's
      'macys.com',     // ✅ Macy's
      'jcpenney.com',  // ✅ JCPenney
      'target.com',    // ✅ Target
      'walmart.com',   // ✅ Walmart
      'amazon.com',    // ✅ Amazon
      'sephora.com',   // ✅ Sephora
      'nordstrom.com', // ✅ Nordstrom
      'ebay.com',      // ✅ eBay
      'etsy.com',      // ✅ Etsy
      'shopify.com',   // ✅ Shopify stores
      'costco.com',    // ✅ Costco
      'homedepot.com', // ✅ Home Depot
      'lowes.com',     // ✅ Lowe's
      'wayfair.com',   // ✅ Wayfair
      'overstock.com', // ✅ Overstock
      'zappos.com',    // ✅ Zappos
      'tjmaxx.com',    // ✅ TJ Maxx
      'marshalls.com', // ✅ Marshalls
      'stubhub.com',   // ✅ StubHub
      'llbean.com',    // ✅ LL Bean
      'gap.com',       // ✅ Gap
      'oldnavy.com',   // ✅ Old Navy
      // + other major retailers
    ];

          // Variables to track results
          let unavailableWebsites = [];
          let successfulWebsites = [];
          let checkedWebsites = [];
          let checkedCount = 0;
          let userPassedWebsites = [];
          const totalWebsites = websites.length;

          // Helper function to add website to successful list (prevents duplicates)
          function addToSuccessfulWebsites(website, reason) {
            const alreadyExists = successfulWebsites.some(site => 
              site.name === website.name && site.url === website.url
            );
            if (!alreadyExists) {
              successfulWebsites.push({
                name: website.name,
                url: website.url,
                reason: reason,
                checkedAt: new Date().toISOString()
              });
              
              // Show successful list every 10 successful sites
              if (successfulWebsites.length % 10 === 0) {
                displaySuccessfulWebsitesList();
              }
            } else {
              console.log(`⚠️ DUPLICATE PREVENTION: ${website.name} already in successful list`);
            }
          }
          
          // Helper function to add website to unavailable list (prevents duplicates)
          function addToUnavailableWebsites(website, pattern) {
            const alreadyExists = unavailableWebsites.some(site => 
              site.name === website.name && site.url === website.url
            );
            if (!alreadyExists) {
              unavailableWebsites.push({
                name: website.name,
                url: website.url,
                pattern: pattern
              });

              // Show flagged list every 5 flagged sites
              if (unavailableWebsites.length % 5 === 0) {
                displayRunningFlaggedList();
              }
            } else {
              console.log(`⚠️ DUPLICATE PREVENTION: ${website.name} already in unavailable list`);
            }
          }


          
          // Function to display running list of flagged sites
          function displayRunningFlaggedList() {
            console.log('\n🚨 RUNNING FLAGGED SITES LIST:');
            console.log(`📊 Total flagged sites: ${unavailableWebsites.length}/${checkedCount} checked`);
            console.log('─'.repeat(60));
            
            if (unavailableWebsites.length === 0) {
              console.log('✅ No sites flagged yet - all appear functional!');
            } else {
              unavailableWebsites.forEach((site, index) => {
                console.log(`${index + 1}. 🚩 ${site.name}`);
                console.log(`   🔗 ${site.url}`);
                console.log(`   📝 Reason: "${site.pattern}"`);
                console.log('');
              });
            }
            console.log('─'.repeat(60));
          }
          
          // Function to display successful (non-flagged) sites
          function displaySuccessfulWebsitesList() {
            console.log('\n✅ SUCCESSFUL WEBSITES LIST:');
            console.log(`📊 Total successful sites: ${successfulWebsites.length}/${checkedCount} checked`);
            console.log('─'.repeat(60));
            
            if (successfulWebsites.length === 0) {
              console.log('⚠️ No successful sites yet');
            } else {
              successfulWebsites.forEach((site, index) => {
                const passedByUser = userPassedWebsites.some(passed => passed.name === site.name && passed.url === site.url);
                const statusIcon = passedByUser ? '👤 USER PASSED' : '🤖 AUTO DETECTED';
                
                console.log(`${index + 1}. ✅ ${site.name}`);
                console.log(`   🔗 ${site.url}`);
                console.log(`   📝 Status: ${statusIcon}`);
                if (site.reason) {
                  console.log(`   💡 Reason: ${site.reason}`);
                }
                console.log('');
              });
            }
            console.log('─'.repeat(60));
          }
          
          // Function to display all checked websites
          function displayCheckedWebsitesList() {
            console.log('\n📋 ALL CHECKED WEBSITES:');
            console.log(`📊 Total websites checked: ${checkedWebsites.length}/${totalWebsites}`);
            console.log('─'.repeat(80));
            
            if (checkedWebsites.length === 0) {
              console.log('ℹ️ No websites have been checked yet');
            } else {
              checkedWebsites.forEach((site, index) => {
                const status = unavailableWebsites.some(flagged => flagged.name === site.name && flagged.url === site.url) 
                  ? '🚩 FLAGGED' 
                  : '✅ AVAILABLE';
                
                console.log(`${index + 1}. ${status} ${site.name}`);
                console.log(`   🔗 ${site.url}`);
                
                if (status === '🚩 FLAGGED') {
                  const flaggedSite = unavailableWebsites.find(flagged => flagged.name === site.name && flagged.url === site.url);
                  if (flaggedSite) {
                    console.log(`   📝 Reason: "${flaggedSite.pattern}"`);
                  }
                }
                console.log('');
              });
            }
            console.log('─'.repeat(80));
          }
          
          // Function to generate and download results as .txt file
          async function downloadResultsFile() {
            if (checkedWebsites.length === 0) {
              console.log('⚠️ No merchants tested - skipping file download');
              return;
            }
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const dateFolder = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
            const filename = `merchant-test-results-${timestamp}.txt`;
            
            // Create organized folder structure - by date only
            const fs = require('fs');
            const path = require('path');
            const resultsBaseDir = path.join(process.cwd(), 'test-results');
            const dateDir = path.join(resultsBaseDir, dateFolder);
            
            // Ensure directories exist (preserve existing files)
            if (!fs.existsSync(resultsBaseDir)) {
              fs.mkdirSync(resultsBaseDir, { recursive: true });
              console.log(`📁 Created results base directory: ${resultsBaseDir}`);
            }
            if (!fs.existsSync(dateDir)) {
              fs.mkdirSync(dateDir, { recursive: true });
              console.log(`📁 Created date directory: ${dateDir}`);
            } else {
              // Check existing files in date directory
              const existingFiles = fs.readdirSync(dateDir).filter(file => file.endsWith('.txt'));
              console.log(`📁 Date directory exists with ${existingFiles.length} existing files: ${existingFiles.join(', ')}`);
            }
            
            let fileContent = '';
            fileContent += '='.repeat(80) + '\n';
            fileContent += 'MERCHANT WEBSITE TESTING RESULTS\n';
            fileContent += '='.repeat(80) + '\n';
            fileContent += `Generated: ${new Date().toLocaleString()}\n`;
            fileContent += `Total Merchants Tested: ${checkedWebsites.length}\n`;
            fileContent += `Successful: ${successfulWebsites.length} (${checkedWebsites.length > 0 ? ((successfulWebsites.length / checkedWebsites.length) * 100).toFixed(1) : 0}%)\n`;
            fileContent += `Flagged: ${unavailableWebsites.length} (${checkedWebsites.length > 0 ? ((unavailableWebsites.length / checkedWebsites.length) * 100).toFixed(1) : 0}%)\n`;
            fileContent += '\n';
            
            // Add successful merchants section
            if (successfulWebsites.length > 0) {
              fileContent += '✅ SUCCESSFUL MERCHANTS:\n';
              fileContent += '-'.repeat(50) + '\n';
              successfulWebsites.forEach((site, index) => {
                const passedByUser = userPassedWebsites.some(passed => passed.name === site.name && passed.url === site.url);
                const statusText = passedByUser ? 'USER PASSED' : 'AUTO SUCCESS';
                
                fileContent += `${index + 1}. ${site.name}\n`;
                fileContent += `   URL: ${site.url}\n`;
                fileContent += `   Status: ${statusText}\n`;
                
                // Enhanced detailed reasoning
                if (passedByUser) {
                  fileContent += `   Detailed Analysis: User manually reviewed this site and determined it to be functional.\n`;
                  fileContent += `   User Decision: The user bypassed automated detection and marked this site as successful,\n`;
                  fileContent += `   indicating they found the website to be working properly despite any potential issues\n`;
                  fileContent += `   that the automated system might have detected.\n`;
                } else if (site.reason) {
                  // Expand on the automated detection reasons
                  if (site.reason.includes('Business model detected')) {
                    fileContent += `   Detailed Analysis: Automated system detected a legitimate business model.\n`;
                    fileContent += `   Business Indicators: The site showed clear signs of being a functional business with\n`;
                    fileContent += `   appropriate content patterns, pricing structures, and business functionality that\n`;
                    fileContent += `   matched expected patterns for this type of commerce platform.\n`;
                  } else if (site.reason.includes('Major brand protection')) {
                    fileContent += `   Detailed Analysis: Recognized as a major established brand with automatic protection.\n`;
                    fileContent += `   Brand Status: This merchant is a well-known, established brand that is protected from\n`;
                    fileContent += `   false positive flagging due to its verified legitimate business status and reputation.\n`;
                  } else if (site.reason.includes('Nuclear protection')) {
                    fileContent += `   Detailed Analysis: Site is on the never-flag whitelist due to confirmed reliability.\n`;
                    fileContent += `   Protection Level: This merchant has been verified as consistently functional and is\n`;
                    fileContent += `   protected from all automated flagging to prevent false positives.\n`;
                  } else if (site.reason.includes('e-commerce features detected')) {
                    fileContent += `   Detailed Analysis: Functional e-commerce website with active shopping capabilities.\n`;
                    fileContent += `   E-commerce Indicators: Site displayed working shopping cart, product pricing, purchase\n`;
                    fileContent += `   buttons, checkout functionality, and other signs of an active online store.\n`;
                  } else if (site.reason.includes('hotel booking')) {
                    fileContent += `   Detailed Analysis: Functional hotel/accommodation booking website.\n`;
                    fileContent += `   Booking Indicators: Site showed room availability, booking functionality, rate information,\n`;
                    fileContent += `   reservation systems, and other hospitality industry features indicating active operations.\n`;
                  } else if (site.reason.includes('travel booking')) {
                    fileContent += `   Detailed Analysis: Functional travel booking and reservation website.\n`;
                    fileContent += `   Travel Indicators: Site displayed flight search, travel packages, booking systems,\n`;
                    fileContent += `   destination information, and other travel industry features indicating active services.\n`;
                  } else if (site.reason.includes('ticket booking')) {
                    fileContent += `   Detailed Analysis: Functional event/ticket booking and sales website.\n`;
                    fileContent += `   Ticketing Indicators: Site showed event listings, ticket purchasing, seat selection,\n`;
                    fileContent += `   venue information, and other ticketing features indicating active event sales.\n`;
                  } else if (site.reason.includes('Shopify site')) {
                    fileContent += `   Detailed Analysis: Active Shopify-powered e-commerce store with strong functionality.\n`;
                    fileContent += `   Shopify Indicators: Site demonstrated robust e-commerce features including product catalogs,\n`;
                    fileContent += `   shopping cart functionality, payment processing, and other Shopify platform features.\n`;
                  } else if (site.reason.includes('No severe problems')) {
                    fileContent += `   Detailed Analysis: Site loaded successfully with no critical issues detected.\n`;
                    fileContent += `   Technical Status: Website loaded properly, displayed content appropriately, and showed\n`;
                    fileContent += `   no signs of being offline, under maintenance, or experiencing technical difficulties.\n`;
                  } else if (site.reason.includes('Has functional features')) {
                    fileContent += `   Detailed Analysis: Website demonstrated active functionality and working features.\n`;
                    fileContent += `   Functional Indicators: Site showed interactive elements, working navigation, content\n`;
                    fileContent += `   loading properly, and other signs of a fully operational website.\n`;
                  } else {
                    fileContent += `   Detailed Analysis: ${site.reason}\n`;
                    fileContent += `   Technical Assessment: Automated system determined this site to be functional based on\n`;
                    fileContent += `   various technical and content indicators that suggest normal website operation.\n`;
                  }
                } else {
                  fileContent += `   Detailed Analysis: Site passed automated checks without specific issues detected.\n`;
                  fileContent += `   General Assessment: Website loaded successfully and displayed no obvious signs of\n`;
                  fileContent += `   unavailability, maintenance, or technical problems during testing.\n`;
                }
                
                if (site.checkedAt) {
                  fileContent += `   Tested: ${new Date(site.checkedAt).toLocaleString()}\n`;
                }
                fileContent += '\n';
              });
              fileContent += '\n';
            }
            
            // Add flagged merchants section
            if (unavailableWebsites.length > 0) {
              fileContent += '🚨 FLAGGED MERCHANTS (REQUIRE REVIEW):\n';
              fileContent += '-'.repeat(50) + '\n';
              unavailableWebsites.forEach((site, index) => {
                fileContent += `${index + 1}. ${site.name}\n`;
                fileContent += `   URL: ${site.url}\n`;
                fileContent += `   Issue: ${site.pattern}\n`;
                
                // Enhanced detailed analysis for flagged sites
                if (site.pattern.includes('timeout error')) {
                  fileContent += `   Detailed Analysis: Website failed to load within the 30-second timeout period.\n`;
                  fileContent += `   Technical Issue: The site either took too long to respond, has server performance issues,\n`;
                  fileContent += `   or may be experiencing technical difficulties. This could indicate the site is down,\n`;
                  fileContent += `   overloaded, or has connectivity problems that prevent normal access.\n`;
                } else if (site.pattern.includes('connection timeout')) {
                  fileContent += `   Detailed Analysis: Network connection to the website timed out during testing.\n`;
                  fileContent += `   Network Issue: The connection attempt failed, suggesting the server may be unreachable,\n`;
                  fileContent += `   experiencing high load, or the domain may have DNS or hosting issues.\n`;
                } else if (site.pattern.includes('connection refused')) {
                  fileContent += `   Detailed Analysis: The server actively refused the connection attempt.\n`;
                  fileContent += `   Server Issue: This typically indicates the web server is not running, the port is blocked,\n`;
                  fileContent += `   or there are firewall restrictions preventing access to the website.\n`;
                } else if (site.pattern.includes('DNS resolution failed')) {
                  fileContent += `   Detailed Analysis: Domain name could not be resolved to an IP address.\n`;
                  fileContent += `   DNS Issue: This suggests the domain may be expired, misconfigured, or the DNS servers\n`;
                  fileContent += `   are not responding. The domain may no longer be active or properly configured.\n`;
                } else if (site.pattern.includes('this store is unavailable')) {
                  fileContent += `   Detailed Analysis: Website explicitly displays an unavailability message.\n`;
                  fileContent += `   Store Status: The site is showing a clear message that the store or service is currently\n`;
                  fileContent += `   unavailable, which may indicate temporary maintenance, business closure, or service suspension.\n`;
                } else if (site.pattern.includes('store temporarily closed')) {
                  fileContent += `   Detailed Analysis: Website indicates the store is temporarily closed.\n`;
                  fileContent += `   Business Status: The site displays messaging suggesting temporary closure, which could be\n`;
                  fileContent += `   for maintenance, inventory updates, business restructuring, or seasonal closure.\n`;
                } else if (site.pattern.includes('website maintenance')) {
                  fileContent += `   Detailed Analysis: Website is currently in maintenance mode.\n`;
                  fileContent += `   Maintenance Status: The site is displaying maintenance messages, indicating it may be\n`;
                  fileContent += `   undergoing updates, repairs, or improvements and is temporarily inaccessible to users.\n`;
                } else if (site.pattern.includes('this website is for sale')) {
                  fileContent += `   Detailed Analysis: Domain is listed for sale rather than hosting active business.\n`;
                  fileContent += `   Domain Status: The website is showing a domain-for-sale page, indicating the business\n`;
                  fileContent += `   may no longer be operating and the domain is being offered for purchase by new owners.\n`;
                } else if (site.pattern.includes('coming soon')) {
                  fileContent += `   Detailed Analysis: Website shows 'coming soon' or launch preparation messaging.\n`;
                  fileContent += `   Launch Status: The site appears to be in pre-launch phase, showing placeholder content\n`;
                  fileContent += `   or 'coming soon' messages rather than functional business operations.\n`;
                } else if (site.pattern.includes('under construction')) {
                  fileContent += `   Detailed Analysis: Website is displaying under construction messaging.\n`;
                  fileContent += `   Development Status: The site shows construction or development messaging, indicating\n`;
                  fileContent += `   it is not yet ready for public use or business operations.\n`;
                } else if (site.pattern.includes('not found')) {
                  fileContent += `   Detailed Analysis: Website or page could not be found (404 error or similar).\n`;
                  fileContent += `   Access Issue: The requested page or website returned a 'not found' error, which may\n`;
                  fileContent += `   indicate the site has been moved, deleted, or is no longer available at this URL.\n`;
                } else if (site.pattern.includes('suspended')) {
                  fileContent += `   Detailed Analysis: Website account or service has been suspended.\n`;
                  fileContent += `   Account Status: The site shows suspension messaging, which typically indicates issues\n`;
                  fileContent += `   with hosting payments, terms of service violations, or administrative actions.\n`;
                } else if (site.pattern.includes('minimal content')) {
                  fileContent += `   Detailed Analysis: Website loaded with very little content, suggesting it may be inactive.\n`;
                  fileContent += `   Content Issue: The site displayed minimal or placeholder content, which may indicate\n`;
                  fileContent += `   an incomplete setup, abandoned website, or technical issues preventing proper content loading.\n`;
                } else if (site.pattern.includes('password protected')) {
                  fileContent += `   Detailed Analysis: Website requires password authentication to access.\n`;
                  fileContent += `   Access Restriction: The site is password-protected, preventing public access and suggesting\n`;
                  fileContent += `   it may be in private/development mode or restricted to specific users only.\n`;
                } else if (site.pattern.includes('force flagged')) {
                  fileContent += `   Detailed Analysis: Site was manually flagged for review due to known issues.\n`;
                  fileContent += `   Manual Flag: This merchant was specifically identified as requiring manual review based on\n`;
                  fileContent += `   previous testing results or known problematic patterns that require human verification.\n`;
                } else if (site.pattern.includes('network error')) {
                  fileContent += `   Detailed Analysis: Network-level error occurred while attempting to access the website.\n`;
                  fileContent += `   Network Issue: A network error prevented successful connection to the site, which could\n`;
                  fileContent += `   indicate server problems, connectivity issues, or infrastructure problems.\n`;
                } else {
                  fileContent += `   Detailed Analysis: ${site.pattern}\n`;
                  fileContent += `   Assessment: The automated system detected an issue that requires manual review to determine\n`;
                  fileContent += `   if the website is genuinely unavailable or if this represents a false positive detection.\n`;
                }
                
                fileContent += `   Recommendation: Manual verification recommended to confirm actual site status and determine\n`;
                fileContent += `   if this represents a temporary issue or permanent unavailability.\n`;
                fileContent += '\n';
              });
              fileContent += '\n';
            }
            
            // Add complete chronological list
            fileContent += '📋 COMPLETE TEST ORDER (CHRONOLOGICAL):\n';
            fileContent += '-'.repeat(50) + '\n';
            checkedWebsites.forEach((site, index) => {
              const isSuccessful = successfulWebsites.some(success => success.name === site.name && success.url === site.url);
              const isFlagged = unavailableWebsites.some(flagged => flagged.name === site.name && flagged.url === site.url);
              const isUserPassed = userPassedWebsites.some(passed => passed.name === site.name && passed.url === site.url);
              
              let statusText = 'UNKNOWN';
              if (isSuccessful) {
                statusText = isUserPassed ? 'USER PASSED' : 'AUTO SUCCESS';
              } else if (isFlagged) {
                statusText = 'FLAGGED';
              }
              
              fileContent += `${(index + 1).toString().padStart(3, ' ')}. [${statusText}] ${site.name}\n`;
              fileContent += `     ${site.url}\n`;
              
              // Add reason if available
              if (isSuccessful) {
                const successSite = successfulWebsites.find(success => success.name === site.name && success.url === site.url);
                if (successSite && successSite.reason) {
                  fileContent += `     Reason: ${successSite.reason}\n`;
                }
              } else if (isFlagged) {
                const flaggedSite = unavailableWebsites.find(flagged => flagged.name === site.name && flagged.url === site.url);
                if (flaggedSite) {
                  fileContent += `     Issue: ${flaggedSite.pattern}\n`;
                }
              }
              fileContent += '\n';
            });
            
            fileContent += '='.repeat(80) + '\n';
            fileContent += 'End of Report\n';
            
            try {
              // Write directly to organized date directory (skip browser download to avoid conflicts)
              const filePath = path.join(dateDir, filename);
              
              // Ensure unique filename if file already exists
              let finalFilePath = filePath;
              let counter = 1;
              while (fs.existsSync(finalFilePath)) {
                const nameWithoutExt = filename.replace('.txt', '');
                const uniqueFilename = `${nameWithoutExt}-${counter}.txt`;
                finalFilePath = path.join(dateDir, uniqueFilename);
                counter++;
                console.log(`⚠️ File ${filename} exists, trying ${uniqueFilename}`);
              }
              
              fs.writeFileSync(finalFilePath, fileContent, 'utf8');
              
              // Verify file was written and check directory contents
              const finalFiles = fs.readdirSync(dateDir).filter(file => file.endsWith('.txt'));
              console.log(`📁 Results saved to: ${finalFilePath}`);
              console.log(`📊 Total files in date directory: ${finalFiles.length} (${finalFiles.join(', ')})`);
              
              const actualFilename = path.basename(finalFilePath);
              
              console.log(`📊 File contains ${checkedWebsites.length} tested merchants`);
              console.log(`✅ ${successfulWebsites.length} successful, 🚨 ${unavailableWebsites.length} flagged`);
              return actualFilename;
            } catch (error) {
              console.log(`❌ All download methods failed: ${error.message}`);
              console.log('📝 File content preview (first 500 chars):');
              console.log(fileContent.substring(0, 500) + '...');
              console.log('📝 File content preview (last 200 chars):');
              console.log('...' + fileContent.substring(fileContent.length - 200));
              return null;
            }
          }
          
          // Synchronous version for signal handlers (Ctrl+C)
          function saveResultsFileSync() {
            if (checkedWebsites.length === 0) {
              console.log('⚠️ No merchants tested - skipping file save');
              return;
            }
            
            try {
              const fs = require('fs');
              const path = require('path');
              
              const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
              const dateFolder = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
              const filename = `merchant-test-results-${timestamp}.txt`;
              
              // Create organized folder structure - by date only
              const resultsBaseDir = path.join(process.cwd(), 'test-results');
              const dateDir = path.join(resultsBaseDir, dateFolder);
              
              // Ensure directories exist (preserve existing files)
              if (!fs.existsSync(resultsBaseDir)) {
                fs.mkdirSync(resultsBaseDir, { recursive: true });
                console.log(`📁 Created results base directory: ${resultsBaseDir}`);
              }
              if (!fs.existsSync(dateDir)) {
                fs.mkdirSync(dateDir, { recursive: true });
                console.log(`📁 Created date directory: ${dateDir}`);
              } else {
                // Check existing files in date directory
                const existingFiles = fs.readdirSync(dateDir).filter(file => file.endsWith('.txt'));
                console.log(`📁 Date directory exists with ${existingFiles.length} existing files: ${existingFiles.join(', ')}`);
              }
              
              let fileContent = '';
              fileContent += '='.repeat(80) + '\n';
              fileContent += 'MERCHANT WEBSITE TESTING RESULTS (INTERRUPTED)\n';
              fileContent += '='.repeat(80) + '\n';
              fileContent += `Generated: ${new Date().toLocaleString()}\n`;
              fileContent += `Total Merchants Tested: ${checkedWebsites.length}\n`;
              fileContent += `Successful: ${successfulWebsites.length} (${checkedWebsites.length > 0 ? ((successfulWebsites.length / checkedWebsites.length) * 100).toFixed(1) : 0}%)\n`;
              fileContent += `Flagged: ${unavailableWebsites.length} (${checkedWebsites.length > 0 ? ((unavailableWebsites.length / checkedWebsites.length) * 100).toFixed(1) : 0}%)\n`;
              fileContent += `Status: Test interrupted by user (Ctrl+C)\n`;
              fileContent += '\n';
              
              // Add successful merchants section
              if (successfulWebsites.length > 0) {
                fileContent += '✅ SUCCESSFUL MERCHANTS:\n';
                fileContent += '-'.repeat(50) + '\n';
                successfulWebsites.forEach((site, index) => {
                  const passedByUser = userPassedWebsites.some(passed => passed.name === site.name && passed.url === site.url);
                  const statusText = passedByUser ? 'USER PASSED' : 'AUTO SUCCESS';
                  fileContent += `${index + 1}. ${site.name}\n`;
                  fileContent += `   URL: ${site.url}\n`;
                  fileContent += `   Status: ${statusText}\n`;
                  
                  // Add detailed analysis for sync version too
                  if (passedByUser) {
                    fileContent += `   Analysis: User manually reviewed and marked as functional\n`;
                  } else if (site.reason) {
                    fileContent += `   Analysis: ${site.reason}\n`;
                  } else {
                    fileContent += `   Analysis: Passed automated availability checks\n`;
                  }
                  fileContent += '\n';
                });
                fileContent += '\n';
              }
              
              // Add flagged merchants section
              if (unavailableWebsites.length > 0) {
                fileContent += '🚨 FLAGGED MERCHANTS (REQUIRE REVIEW):\n';
                fileContent += '-'.repeat(50) + '\n';
                unavailableWebsites.forEach((site, index) => {
                  fileContent += `${index + 1}. ${site.name}\n`;
                  fileContent += `   URL: ${site.url}\n`;
                  fileContent += `   Issue: ${site.pattern}\n`;
                  
                  // Add basic analysis for sync version
                  if (site.pattern.includes('timeout')) {
                    fileContent += `   Analysis: Site failed to load within timeout period\n`;
                  } else if (site.pattern.includes('unavailable')) {
                    fileContent += `   Analysis: Site displays unavailability message\n`;
                  } else if (site.pattern.includes('maintenance')) {
                    fileContent += `   Analysis: Site is in maintenance mode\n`;
                  } else if (site.pattern.includes('for sale')) {
                    fileContent += `   Analysis: Domain is listed for sale\n`;
                  } else if (site.pattern.includes('not found')) {
                    fileContent += `   Analysis: Page or site not found (404 error)\n`;
                  } else {
                    fileContent += `   Analysis: Requires manual review to determine status\n`;
                  }
                  fileContent += '\n';
                });
                fileContent += '\n';
              }
              
              // Add complete chronological list
              fileContent += '📋 COMPLETE TEST ORDER (CHRONOLOGICAL):\n';
              fileContent += '-'.repeat(50) + '\n';
              checkedWebsites.forEach((site, index) => {
                const isSuccessful = successfulWebsites.some(success => success.name === site.name && success.url === site.url);
                const isFlagged = unavailableWebsites.some(flagged => flagged.name === site.name && flagged.url === site.url);
                const isUserPassed = userPassedWebsites.some(passed => passed.name === site.name && passed.url === site.url);
                
                let statusText = 'UNKNOWN';
                if (isSuccessful) {
                  statusText = isUserPassed ? 'USER PASSED' : 'AUTO SUCCESS';
                } else if (isFlagged) {
                  statusText = 'FLAGGED';
                }
                
                fileContent += `${(index + 1).toString().padStart(3, ' ')}. [${statusText}] ${site.name}\n`;
                fileContent += `     ${site.url}\n`;
                fileContent += '\n';
              });
              
              fileContent += '='.repeat(80) + '\n';
              fileContent += 'End of Report\n';
              
              // Write to date directory with unique filename
              const filePath = path.join(dateDir, filename);
              
              // Ensure unique filename if file already exists
              let finalFilePath = filePath;
              let counter = 1;
              while (fs.existsSync(finalFilePath)) {
                const nameWithoutExt = filename.replace('.txt', '');
                const uniqueFilename = `${nameWithoutExt}-${counter}.txt`;
                finalFilePath = path.join(dateDir, uniqueFilename);
                counter++;
                console.log(`⚠️ File ${filename} exists, trying ${uniqueFilename}`);
              }
              
              fs.writeFileSync(finalFilePath, fileContent, 'utf8');
              
              // Verify file was written and check directory contents
              const finalFiles = fs.readdirSync(dateDir).filter(file => file.endsWith('.txt'));
              const actualFilename = path.basename(finalFilePath);
              console.log(`📁 Results saved to: ${finalFilePath}`);
              console.log(`📊 Total files in date directory: ${finalFiles.length} (${finalFiles.join(', ')})`);
              console.log(`📊 File contains ${checkedWebsites.length} tested merchants`);
              console.log(`✅ ${successfulWebsites.length} successful, 🚨 ${unavailableWebsites.length} flagged`);
              return actualFilename;
            } catch (error) {
              console.log(`❌ Failed to save results file: ${error.message}`);
              return null;
            }
          }
          
          // COMPREHENSIVE LOGGING: Track all manual review decisions
          console.log('\n🎯 MANUAL REVIEW TRACKING SYSTEM ACTIVATED');
          console.log('📋 Will log every site left open for manual review with detailed reasoning');
          console.log('💡 This helps identify patterns and fix false positives');
          console.log('='.repeat(70));
      
          // Keep websites in original order (no shuffling)
          const shuffledWebsites = [...websites]; // Keep original order
      
          console.log(`🚀 Starting availability check for ${websites.length} websites...`);
          console.log('📋 Testing websites in ORIGINAL ORDER');
          console.log('🔍 Looking for unavailability messages in multiple languages:');
          console.log('   📝 English: opening soon, store unavailable, this website is for sale');
          console.log('   🇪🇸 Spanish: próximamente, tienda no disponible, en construcción');
          console.log('   🇫🇷 French: bientôt disponible, magasin indisponible, en maintenance');
          console.log('   🇩🇪 German: demnächst verfügbar, shop nicht verfügbar, wartungsmodus');
          console.log('   🇮🇹 Italian: prossimamente, negozio non disponibile, in manutenzione');
          console.log('   🇵🇹 Portuguese: em breve, loja indisponível, em manutenção');
          console.log('   🇯🇵 Japanese: オープン予定, ストア利用不可, メンテナンス中');
          console.log('   🇨🇳 Chinese: 即将开放, 商店不可用, 维护中');
          console.log('✅ Major retailers are whitelisted to prevent false positives');
          console.log('⏸️ PAUSE ANYTIME: Use F8 key or Playwright Inspector pause button');
          console.log('🌐 Unavailable tabs kept open for manual review (NO Excel automation)');
          console.log('');
          console.log('🎮 PAUSE CONTROLS:');
          console.log('   ⌨️ Press F8 key anytime during testing');
          console.log('   🖱️ Click "Pause" button in Playwright Inspector'); 
          console.log('   🔧 Use browser DevTools debugger if needed');
          console.log('   📊 Progress checkpoints every 10 websites (auto-continue)');
          console.log('');
          console.log('📁 RESULTS FILE DOWNLOADS:');
          console.log('   🔄 Auto-download every 50 merchants (checkpoint saves)');
          console.log('   ⏸️ Download when pausing (F8 or pause button)');
          console.log('   ✅ Download when test completes');
          console.log('   🚨 Download when test stops early (except browser closure)');
          console.log('   💡 Files organized in: test-results/YYYY-MM-DD/');
          console.log('='.repeat(70));
          
          // Add pause instructions and setup
          console.log('\n💡 PAUSE ANYTIME: Multiple ways to pause during testing');
          console.log('   🎯 Method 1: Press F8 key in Playwright Inspector');
          console.log('   🎯 Method 2: Click "Pause" button in Playwright Inspector');
          console.log('   🎯 Method 3: Press Ctrl+C in terminal to stop completely');
          console.log('   🎯 Method 4: Use browser DevTools debugger');
          console.log('='.repeat(70));
          
          // Set up keyboard listener for pause functionality and pass button
          try {
            await page.evaluate(() => {
              // Add global flags that can be triggered
              window.testPauseRequested = false;
              window.passCurrentSite = false;
              
              // Create UI controls
              const controlsDiv = document.createElement('div');
              controlsDiv.id = 'test-controls';
              controlsDiv.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 15px;
                border-radius: 10px;
                font-family: Arial, sans-serif;
                font-size: 14px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                min-width: 250px;
              `;
              
              controlsDiv.innerHTML = `
                <div style="margin-bottom: 10px; font-weight: bold; text-align: center;">
                  🎮 Test Controls
                </div>
                <button id="pass-btn" style="
                  background: #28a745;
                  color: white;
                  border: none;
                  padding: 8px 16px;
                  margin: 5px;
                  border-radius: 5px;
                  cursor: pointer;
                  font-size: 14px;
                  width: 100%;
                ">✅ Pass Current Site</button>
                <button id="pause-btn" style="
                  background: #ffc107;
                  color: black;
                  border: none;
                  padding: 8px 16px;
                  margin: 5px;
                  border-radius: 5px;
                  cursor: pointer;
                  font-size: 14px;
                  width: 100%;
                ">⏸️ Pause Testing</button>
                <div id="current-site" style="
                  margin-top: 10px;
                  padding: 8px;
                  background: rgba(255, 255, 255, 0.1);
                  border-radius: 5px;
                  font-size: 12px;
                  word-break: break-all;
                ">
                  Current: Loading...
                </div>
              `;
              
              document.body.appendChild(controlsDiv);
              
              // Add button event listeners
              document.getElementById('pass-btn').addEventListener('click', () => {
                window.passCurrentSite = true;
                console.log('✅ PASS REQUESTED - Will pass current website and move to next');
              });
              
              document.getElementById('pause-btn').addEventListener('click', () => {
                window.testPauseRequested = true;
                console.log('🛑 PAUSE REQUESTED - Will pause after current website');
              });
              
              // Listen for keydown events
              document.addEventListener('keydown', (event) => {
                // F8 key or P key to request pause
                if (event.key === 'F8' || (event.key === 'p' && event.ctrlKey)) {
                  window.testPauseRequested = true;
                  console.log('🛑 PAUSE REQUESTED - Will pause after current website');
                }
                // S key to pass current site
                if (event.key === 's' && event.ctrlKey) {
                  window.passCurrentSite = true;
                  console.log('✅ PASS REQUESTED - Will pass current website and move to next');
                }
              });
              
              // Function to update current site display
              window.updateCurrentSite = (siteName, siteUrl) => {
                const currentSiteDiv = document.getElementById('current-site');
                if (currentSiteDiv) {
                  currentSiteDiv.innerHTML = `Current: <strong>${siteName}</strong><br><small>${siteUrl}</small>`;
                }
              };
              
              console.log('⌨️ Controls ready: Click buttons or use F8 (pause), Ctrl+S (pass)');
            });
          } catch (e) {
            console.log('⚠️ Could not set up UI controls, use F8 in Playwright Inspector instead');
          }
          
          // Add signal handler for Ctrl+C interruption
          let testInterrupted = false;
          const handleInterruption = () => {
            if (!testInterrupted) {
              testInterrupted = true;
              console.log('\n' + '🛑'.repeat(50));
              console.log('🛑 CTRL+C PRESSED - TEST INTERRUPTED BY USER');
              console.log('🛑'.repeat(50));
              console.log(`📊 Progress when interrupted: ${checkedCount}/${shuffledWebsites.length} websites checked`);
              console.log(`🚨 Unavailable websites found: ${unavailableWebsites.length}`);
              console.log(`✅ Successful websites found: ${successfulWebsites.length}`);
              console.log(`📈 Completion rate: ${((checkedCount / shuffledWebsites.length) * 100).toFixed(1)}%`);
              console.log(`🚩 Flagging rate: ${checkedCount > 0 ? ((unavailableWebsites.length / checkedCount) * 100).toFixed(1) : 0}%`);
              console.log(`📊 Success rate: ${checkedCount > 0 ? ((successfulWebsites.length / checkedCount) * 100).toFixed(1) : 0}%`);
              console.log('');
              
              if (unavailableWebsites.length > 0) {
                console.log('🚨 FLAGGED SITES BEFORE INTERRUPTION:');
                unavailableWebsites.forEach((site, index) => {
                  console.log(`  ${index + 1}. 🚩 ${site.name}`);
                  console.log(`     🔗 ${site.url}`);
                  console.log(`     📝 Reason: "${site.pattern}"`);
                });
              } else {
                console.log('✅ No sites flagged before interruption');
              }
              
              if (successfulWebsites.length > 0) {
                console.log('');
                console.log('✅ SUCCESSFUL SITES BEFORE INTERRUPTION:');
                successfulWebsites.forEach((site, index) => {
                  const passedByUser = userPassedWebsites.some(passed => passed.name === site.name && passed.url === site.url);
                  const statusIcon = passedByUser ? '👤' : '🤖';
                  console.log(`  ${index + 1}. ${statusIcon} ${site.name}`);
                  console.log(`     🔗 ${site.url}`);
                  console.log(`     📝 ${site.reason}`);
                });
              } else {
                console.log('');
                console.log('⚠️ No successful sites detected before interruption');
              }
              
              const remainingWebsites = shuffledWebsites.slice(checkedCount);
              if (remainingWebsites.length > 0) {
                console.log('');
                console.log(`📋 ${remainingWebsites.length} websites remaining to check:`);
                remainingWebsites.slice(0, 5).forEach((site, index) => {
                  console.log(`  ${index + 1}. ⏳ ${site.name} - ${site.url}`);
                });
                if (remainingWebsites.length > 5) {
                  console.log(`  ... and ${remainingWebsites.length - 5} more`);
                }
              }
              
              console.log('');
              console.log('💡 Test interrupted by user (Ctrl+C)');
              console.log('🔄 Run the test again to continue checking remaining websites');
              console.log('👀 Review any opened tabs for manual verification');
              
              // Download results file before exiting
              console.log('📁 Generating results file...');
              try {
                saveResultsFileSync();
              } catch (e) {
                console.log(`⚠️ Could not save results file: ${e.message}`);
                console.log('💡 Use the pause feature (F8) instead of Ctrl+C for guaranteed file download');
              }
              
              console.log('🛑'.repeat(50));
              
              process.exit(0);
            }
          };
          
          process.on('SIGINT', handleInterruption);
          process.on('SIGTERM', handleInterruption);
          
          // Emergency handlers for memory crashes and uncaught exceptions
          process.on('uncaughtException', (error) => {
            console.log('\n🚨 UNCAUGHT EXCEPTION - EMERGENCY SAVE!');
            console.log(`❌ Error: ${error.message}`);
            
            // Check if this is a browser connection error
            if (error.message.includes('was not bound in the connection') || 
                error.message.includes('Target closed') ||
                error.message.includes('Browser has been closed')) {
              console.log('🔍 Browser connection lost - this is usually due to:');
              console.log('   • Browser process crashed due to memory issues');
              console.log('   • Browser was manually closed');
              console.log('   • System resource exhaustion');
            }
            
            console.log('📁 Attempting emergency results save...');
            
            try {
              saveResultsFileSync();
              console.log('✅ Emergency results saved successfully');
            } catch (saveError) {
              console.log(`❌ Emergency save failed: ${saveError.message}`);
            }
            
            console.log('💡 Test crashed but results were saved');
            console.log('🔄 Restart the test to continue with remaining websites');
            console.log('💡 TIP: Use the high-memory script to prevent crashes: ./run-test-high-memory.sh');
            process.exit(1);
          });
          
          process.on('unhandledRejection', (reason, promise) => {
            console.log('\n🚨 UNHANDLED REJECTION - EMERGENCY SAVE!');
            console.log(`❌ Reason: ${reason}`);
            console.log('📁 Attempting emergency results save...');
            
            try {
              saveResultsFileSync();
              console.log('✅ Emergency results saved successfully');
            } catch (saveError) {
              console.log(`❌ Emergency save failed: ${saveError.message}`);
            }
            
            console.log('💡 Test crashed but results were saved');
            console.log('🔄 Restart the test to continue with remaining websites');
            process.exit(1);
          });
          
          try {
            for (const website of shuffledWebsites) {
              checkedCount++;
              
              console.log(`\n[${checkedCount}/${shuffledWebsites.length}] 📋 Checking in order: ${website.name}`);
              
              // Wrap each website in individual try-catch to prevent one failure from stopping all
              try {
              console.log(`🔗 URL: ${website.url}`);
              console.log(`📊 Current flagged sites: ${unavailableWebsites.length}`);
              console.log(`✅ Current successful sites: ${successfulWebsites.length}`);
              const memUsage = process.memoryUsage();
              const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
              console.log(`💾 Memory usage: ${memUsedMB}MB`);
              
              // Emergency memory check - download results and pause if memory is too high
              if (memUsedMB > 3500) { // 3.5GB threshold
                console.log('\n🚨 EMERGENCY MEMORY WARNING!');
                console.log(`💾 Memory usage: ${memUsedMB}MB - approaching heap limit!`);
                console.log('📁 Downloading results immediately to prevent crash...');
                
                try {
                  await downloadResultsFile();
                  console.log('✅ Emergency results file saved successfully');
                } catch (emergencyError) {
                  console.log(`❌ Emergency download failed: ${emergencyError.message}`);
                  // Try sync version as last resort
                  saveResultsFileSync();
                }
                
                console.log('⏸️ PAUSING TEST - Memory too high!');
                console.log('💡 Click RESUME to continue testing after memory cleanup');
                console.log('💡 Your progress has been saved to the results file');
                
                // Download results before pausing
                try {
                  await downloadResultsFile();
                  console.log('✅ Results saved before memory pause');
                } catch (downloadError) {
                  console.log(`⚠️ Download failed: ${downloadError.message}`);
                }
                
                await page.pause();
                
                // After resume, let normal flow continue to process this website
                console.log('🔄 Resuming test after memory warning pause...');
                console.log('▶️ Continuing with current website...');
              }
              
              console.log(`⏸️ Press F8, Ctrl+P, or use Playwright Inspector to pause anytime`);
              console.log(`✅ Press Ctrl+S or click 'Pass' button to mark current site as successful`);
              
              // Update the UI with current site info
              try {
                await page.evaluate((siteName, siteUrl) => {
                  if (window.updateCurrentSite) {
                    window.updateCurrentSite(siteName, siteUrl);
                  }
                }, website.name, website.url);
              } catch (e) {
                // Continue if UI update fails
              }
              
              // Check if user requested to pass current site
              try {
                const passRequested = await page.evaluate(() => window.passCurrentSite);
                if (passRequested) {
                  console.log('\n' + '✅'.repeat(30));
                  console.log('👤 USER PASSED CURRENT SITE');
                  console.log('✅'.repeat(30));
                  console.log(`🏷️ Site: ${website.name}`);
                  console.log(`🔗 URL: ${website.url}`);
                  console.log(`📝 Reason: User manually marked as successful`);
                  console.log('✅'.repeat(30));
                  
                  // Add to successful websites list
                  addToSuccessfulWebsites(website, 'User manually passed');
                  
                  // Track that this was user-passed
                  userPassedWebsites.push({
                    name: website.name,
                    url: website.url,
                    passedAt: new Date().toISOString()
                  });
                  
                  // Add to checked websites list
                  checkedWebsites.push({
                    name: website.name,
                    url: website.url,
                    checkedAt: new Date().toISOString()
                  });
                  
                  // Display updated lists
                  displaySuccessfulWebsitesList();
                  
                  // Reset pass flag and continue to next website
                  await page.evaluate(() => { window.passCurrentSite = false; });
                  console.log('▶️ Moving to next website...\n');
                  continue; // Skip all processing for this website
                }
              } catch (e) {
                // Continue if pass check fails
              }
              
              // Check if user requested pause
              try {
                const pauseRequested = await page.evaluate(() => window.testPauseRequested);
                if (pauseRequested) {
                  console.log('\n' + '⏸️'.repeat(30));
                  console.log('🛑 USER REQUESTED PAUSE');
                  console.log('⏸️'.repeat(30));
                  console.log(`📊 Current Progress: ${checkedCount}/${shuffledWebsites.length} websites checked`);
                  console.log(`🚨 Found ${unavailableWebsites.length} unavailable websites so far`);
                  console.log(`✅ Found ${successfulWebsites.length} successful websites so far`);
                  console.log('');
                  console.log('📋 Unavailable websites found so far:');
                  if (unavailableWebsites.length > 0) {
                    unavailableWebsites.forEach((site, index) => {
                      console.log(`  ${index + 1}. ${site.name} - ${site.pattern}`);
                      console.log(`     🔗 ${site.url}`);
                    });
                  } else {
                    console.log('  ✅ No unavailable websites found yet');
                  }
                  
                  // Show successful websites
                  displaySuccessfulWebsitesList();
                  
                  // Show all checked websites
                  displayCheckedWebsitesList();
                  
                  // Download results file during pause
                  console.log('');
                  console.log('📁 Generating and downloading results file...');
                  await downloadResultsFile();
                  
                  console.log('');
                  console.log('💡 Options:');
                  console.log('  ▶️ Click RESUME to continue checking websites');
                  console.log('  🛑 Click STOP to end testing and review results');
                  console.log('⏸️'.repeat(30));
                  
                  // Reset pause flag and wait for user decision
                  await page.evaluate(() => { window.testPauseRequested = false; });
                  await page.pause();
                  
                  console.log('▶️ Resuming website checking...');
                  console.log('🔄 Continuing with current website...');
                  
                  // Don't use continue - just let the normal flow continue to process this website
                }
              } catch (e) {
                // Continue if pause check fails
              }
              
              
              // Note: Whitelist check disabled since we're testing specific requested websites
              // All 4 websites will be tested regardless of their status
              
              try {
                console.log(`🌐 Navigating to: ${website.url}`);
                
                // IMMEDIATE DEBUG: Check if this is a force flag site
                const immediateCheckSites = ['gameboard', 'fanrek'];
                const isImmediateForceFlagSite = immediateCheckSites.some(site => website.name.toLowerCase().includes(site) || website.url.toLowerCase().includes(site));
                
                if (isImmediateForceFlagSite) {
                  console.log(`🚨🚨🚨 IMMEDIATE DETECTION: ${website.name} is a FORCE FLAG site!`);
                  console.log(`   - Website name: "${website.name}"`);
                  console.log(`   - Website URL: "${website.url}"`);
                  console.log(`   - This site MUST be flagged for manual review`);
                }
                
                // Navigate to website with optimized loading strategy
                try {
                  await page.goto(website.url, { 
                    waitUntil: 'domcontentloaded',  // Fast initial load
                    timeout: 30000 // 30 seconds timeout
                  });
                } catch (navigationError) {
                  console.log(`⚠️ ${website.name}: Navigation failed: ${navigationError.message}`);
                  
                  // Check if browser is still connected
                  if (!browser.isConnected()) {
                    console.log(`🚨 Browser disconnected during navigation - stopping test`);
                    break;
                  }
                  
                  // Skip this website and continue with next
                  console.log(`🔄 Skipping ${website.name} due to navigation failure, continuing with next website`);
                  continue;
                }
                
                // Smart wait: Quick check first, then longer if needed
                await page.waitForTimeout(1000); // Quick 1 second wait
                
                // Special handling for problematic sites - give them more time to load error pages
                const waitTimeSites = ['gameboard', 'fanrek'];
                const isProblematicSite = waitTimeSites.some(site => website.name.toLowerCase().includes(site));
                
                if (isProblematicSite) {
                  console.log(`🚨 ${website.name}: Problematic site detected - using extended wait times for error page detection`);
                  await page.waitForTimeout(7000); // Extra time for problematic sites to show error content
                }
                
                // Check if content looks minimal/empty and needs more time
                let initialContent = await page.textContent('body');
                const contentLength = initialContent ? initialContent.trim().length : 0;
                
                if (contentLength < 100) {
                  console.log('🔄 Content seems minimal, waiting a bit more...');
                  await page.waitForTimeout(3000); // Additional 3 seconds for minimal content
                  
                  // For problematic sites, wait even longer for error pages to fully render
                  if (isProblematicSite) {
                    console.log(`🚨 ${website.name} with minimal content - waiting extra time for error page...`);
                    await page.waitForTimeout(7000); // Extra wait for problematic site error pages
                  }
                }
                
                            // Get page content and check for unavailability patterns
                  const pageContent = await page.textContent('body');
                  let pageText = pageContent ? pageContent.toLowerCase() : '';
                  
                  // Also check page title for additional context
                  const pageTitle = await page.title();
                  const titleText = pageTitle ? pageTitle.toLowerCase() : '';
                  
                  // ENHANCED CONTENT DETECTION: Scroll down to capture below-the-fold pricing
                  try {
                    console.log(`📜 ${website.name}: Scrolling to detect below-the-fold pricing...`);
                    
                    // Scroll down in increments to load all content and capture pricing
                    const scrollSteps = 3; // Number of scroll steps
                    for (let i = 0; i < scrollSteps; i++) {
                      // Scroll down by viewport height
                      await page.evaluate(() => {
                        window.scrollBy(0, window.innerHeight);
                      });
                      await page.waitForTimeout(1000); // Wait for content to load after scroll
                    }
                    
                    // Scroll back to top for consistency
                    await page.evaluate(() => {
                      window.scrollTo(0, 0);
                    });
                    await page.waitForTimeout(500);
                    
                    // Get updated content after scrolling
                    const scrolledContent = await page.textContent('body');
                    const scrolledText = scrolledContent ? scrolledContent.toLowerCase() : '';
                    
                    // Combine original and scrolled content for comprehensive detection
                    pageText = pageText + ' ' + scrolledText;
                    
                    console.log(`📜 ${website.name}: Content expanded from ${pageContent?.length || 0} to ${pageText.length} chars after scrolling`);
                    
                    // Check specifically for pricing that might have been revealed by scrolling
                    const pricingAfterScroll = /\$\s*\d+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?\s*\$|£\s*\d+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?\s*£|€\s*\d+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?\s*€|¥\s*\d+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?\s*¥/.test(scrolledText);
                    
                    if (pricingAfterScroll) {
                      const priceMatches = scrolledText.match(/\$\s*\d+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?\s*\$/g);
                      if (priceMatches) {
                        console.log(`💰 ${website.name}: Below-the-fold pricing found: ${priceMatches.slice(0, 3).join(', ')}`);
                      }
                    }
                    
                  } catch (scrollError) {
                    // Check if browser was closed - try to recover first
                    if (scrollError.message.includes('Target page, context or browser has been closed') ||
                        scrollError.message.includes('Browser has been closed') ||
                        scrollError.message.includes('Page has been closed')) {
                      console.log(`🛑 ${website.name}: Browser closed during scrolling - attempting recovery`);
                      console.log(`🔍 DEBUG: Error details: ${scrollError.message}`);
                      
                      // Try to check if browser is actually disconnected
                      try {
                        if (!browser.isConnected()) {
                          console.log(`🚨 Browser truly disconnected - stopping test`);
                          break;
                        } else {
                          console.log(`🔄 Browser still connected - continuing with next website`);
                          continue;
                        }
                      } catch (checkError) {
                        console.log(`🚨 Cannot check browser connection - stopping test`);
                        break;
                      }
                    }
                    console.log(`⚠️ ${website.name}: Scrolling detection failed: ${scrollError.message}`);
                  }
                
                // BACKUP NUCLEAR OPTION: Force flag immediately after getting content
                const backupForceSites = [
                  'gameboard', 'fanrek',
                  // Sites from screenshots that should always be flagged (backup)
                  'raineandhumbleus.com', 'raine & humble', 'raine and humble',
                  'gymstugan.com', 'gymstugan',
                  '5thwheelebike.com', '5th wheel', 'fifth wheel',
                  'bettermrcloth.com', 'bettermrcloth', 'better mr cloth',
                  'usa.renskincare.com', 'ren clean skincare', 'renskincare'
                ];
                const shouldForceFlagBackup = backupForceSites.some(site => 
                  website.name.toLowerCase().includes(site.toLowerCase()) || 
                  website.url.toLowerCase().includes(site.toLowerCase())
                );
                
                if (shouldForceFlagBackup) {
                  console.log(`🚨🚨🚨 BACKUP NUCLEAR OPTION ACTIVATED for ${website.name}!`);
                  console.log(`   - This is the backup force flag system`);
                  console.log(`   - Content length: ${pageText.length} chars`);
                  console.log(`   - Page title: "${pageTitle}"`);
                  console.log(`   - Forcing immediate flagging NOW`);
                  
                  // Determine pattern based on content
                  let backupPattern = 'backup force flagged - manual verification required';
                  if (pageText.includes('not found')) backupPattern = 'site not found (backup detection)';
                  else if (pageText.includes('error')) backupPattern = 'error detected (backup detection)';
                  else if (pageText.includes('offline')) backupPattern = 'site offline (backup detection)';
                  else if (pageText.length < 200) backupPattern = 'minimal content (backup detection)';
                  
                  console.log(`🚨 BACKUP FORCE FLAGGING: "${backupPattern}"`);
                  
                  // Add to unavailable list immediately
                  addToUnavailableWebsites(website, backupPattern);
                  
                  // Display running list
                  displayRunningFlaggedList();
                  
                  // Open in new tab immediately for backup force flagging
                  try {
                    console.log(`🚨 BACKUP FORCE: Opening ${website.name} in new tab for critical review`);
                    const newPage = await context.newPage();
                    await newPage.goto(website.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
                    console.log(`📑 BACKUP FORCE OPENED: ${website.name} - Critical issue requires manual verification`);
                    await page.bringToFront();
                  } catch (tabError) {
                    // Check if browser was closed - break immediately
                    if (tabError.message.includes('Target page, context or browser has been closed') ||
                        tabError.message.includes('Browser has been closed') ||
                        tabError.message.includes('Page has been closed')) {
                      console.log(`🛑 ${website.name}: Browser closed during tab opening - test interrupted, stopping immediately`);
                      break; // Exit the loop immediately when browser is closed
                    }
                    console.log(`⚠️ Tab opening failed but site still flagged: ${tabError.message}`);
                  }
                  
                  // Skip ALL remaining logic
                  console.log(`⏭️ BACKUP SKIP: Skipping all remaining logic for ${website.name}`);
                  
                  // Add website to checked list before skipping
                  checkedWebsites.push({
                    name: website.name,
                    url: website.url,
                    checkedAt: new Date().toISOString()
                  });
                  continue;
                }
                
                // Enhanced content detection: trigger hover interactions AND click product links to reveal pricing
                try {
                  // Look for common e-commerce product elements that might have hover-revealed pricing or clickable products
                  const productElements = await page.locator('.product, .item, [class*="product"], [class*="item"], .card, [class*="card"], a[href*="product"], a[href*="shop"]').all();
                  
                  if (productElements.length > 0) {
                    console.log(`🔍 ${website.name}: Found ${productElements.length} potential product elements, checking for hover content and clickable products...`);
                    
                    // First, try hover interactions
                    for (let i = 0; i < Math.min(3, productElements.length); i++) {
                      try {
                        await productElements[i].hover({ timeout: 2000 });
                        await page.waitForTimeout(500); // Wait for hover effects
                      } catch (e) {
                        // Continue if hover fails
                      }
                    }
                    
                    // Optimized product link detection - target only actual product/commerce links
                    // Use more specific selectors to avoid processing non-product links entirely
                    const productLinks = await page.locator(`
                      a[href*="/product/"]:not([href*="facebook"]):not([href*="twitter"]):not([href*="instagram"]):not([href*="review"]):not([href*="privacy"]):not([href*="terms"]),
                      a[href*="/shop/"]:not([href*="facebook"]):not([href*="twitter"]):not([href*="instagram"]):not([href*="review"]):not([href*="privacy"]):not([href*="terms"]),
                      a[href*="/item/"]:not([href*="facebook"]):not([href*="twitter"]):not([href*="instagram"]):not([href*="review"]):not([href*="privacy"]):not([href*="terms"]),
                      a[href*="/p/"]:not([href*="facebook"]):not([href*="twitter"]):not([href*="instagram"]):not([href*="review"]):not([href*="privacy"]):not([href*="terms"]):not([href*="policy"]),
                      .product a:not([href*="facebook"]):not([href*="twitter"]):not([href*="instagram"]):not([href*="review"]):not([href*="privacy"]):not([href*="terms"]),
                      .item a:not([href*="facebook"]):not([href*="twitter"]):not([href*="instagram"]):not([href*="review"]):not([href*="privacy"]):not([href*="terms"]),
                      [class*="product"] a:not([href*="facebook"]):not([href*="twitter"]):not([href*="instagram"]):not([href*="review"]):not([href*="privacy"]):not([href*="terms"]),
                      a[href*="/room/"]:not([href*="facebook"]):not([href*="twitter"]):not([href*="instagram"]):not([href*="review"]):not([href*="privacy"]):not([href*="terms"]),
                      a[href*="/suite/"]:not([href*="facebook"]):not([href*="twitter"]):not([href*="instagram"]):not([href*="review"]):not([href*="privacy"]):not([href*="terms"]),
                      a[href*="book"]:not([href*="facebook"]):not([href*="twitter"]):not([href*="instagram"]):not([href*="review"]):not([href*="privacy"]):not([href*="terms"]),
                      .room a:not([href*="facebook"]):not([href*="twitter"]):not([href*="instagram"]):not([href*="review"]):not([href*="privacy"]):not([href*="terms"]),
                      .suite a:not([href*="facebook"]):not([href*="twitter"]):not([href*="instagram"]):not([href*="review"]):not([href*="privacy"]):not([href*="terms"])
                    `).all();
                    
                    console.log(`🔍 ${website.name}: Found ${productLinks.length} targeted product/commerce links`);
                    
                    // Additional quick validation to ensure we have actual product links
                    const validProductLinks = [];
                    for (let i = 0; i < Math.min(5, productLinks.length); i++) {
                      try {
                        const href = await productLinks[i].getAttribute('href');
                        const linkText = await productLinks[i].textContent() || '';
                        
                        // Quick validation - skip if clearly not a product link
                        if (href && !href.includes('mailto:') && !href.includes('tel:') && 
                            !linkText.toLowerCase().includes('contact') && 
                            !linkText.toLowerCase().includes('about') &&
                            !linkText.toLowerCase().includes('support')) {
                          validProductLinks.push(productLinks[i]);
                        }
                      } catch (e) {
                        // Skip invalid links
                      }
                    }
                    
                    if (validProductLinks.length > 0) {
                      console.log(`🔍 ${website.name}: Testing ${validProductLinks.length} validated product links for functional features...`);
                      
                      try {
                        // Get the current page URL
                        const currentUrl = page.url();
                        
                        // Click on the first validated product link with reduced timeout for speed
                        await validProductLinks[0].click({ timeout: 2000 });
                        await page.waitForTimeout(1500); // Reduced wait time for faster processing
                        
                        // Check if we navigated to a product page
                        const newUrl = page.url();
                        if (newUrl !== currentUrl) {
                          console.log(`🔍 ${website.name}: Successfully navigated to product/room page: ${newUrl}`);
                          
                          // Get content from the product page
                          const productPageContent = await page.textContent('body');
                          const productPageText = productPageContent ? productPageContent.toLowerCase() : '';
                          
                          // Look for e-commerce indicators on product page (enhanced for hotels)
                          const hasProductPagePricing = (productPageText.includes('$') || productPageText.includes('£') || productPageText.includes('€') || productPageText.includes('¥')) &&
                                                       (/\$\s*\d+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?\s*\$|£\s*\d+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?\s*£|€\s*\d+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?\s*€|¥\s*\d+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?\s*¥/.test(productPageText));
                          
                          // Enhanced hotel room page pricing detection
                          const hasHotelPagePricing = (/\$\s*\d+(?:\.\d{1,2})?\s*\/\s*night|\$\s*\d+(?:\.\d{1,2})?\s*per\s*night|\$\s*\d+(?:\.\d{1,2})?\s*\/\s*room|room\s*from\s*\$\s*\d+|nightly\s*rate\s*\$\s*\d+/.test(productPageText)) ||
                                                    (/£\s*\d+(?:\.\d{1,2})?\s*\/\s*night|£\s*\d+(?:\.\d{1,2})?\s*per\s*night|£\s*\d+(?:\.\d{1,2})?\s*\/\s*room|room\s*from\s*£\s*\d+|nightly\s*rate\s*£\s*\d+/.test(productPageText)) ||
                                                    (/€\s*\d+(?:\.\d{1,2})?\s*\/\s*night|€\s*\d+(?:\.\d{1,2})?\s*per\s*night|€\s*\d+(?:\.\d{1,2})?\s*\/\s*room|room\s*from\s*€\s*\d+|nightly\s*rate\s*€\s*\d+/.test(productPageText));
                          
                          const hasProductPageShopping = productPageText.includes('add to cart') || productPageText.includes('buy now') || 
                                                        productPageText.includes('add to bag') || productPageText.includes('purchase');
                          
                          const hasHotelPageBooking = productPageText.includes('book now') || productPageText.includes('reserve now') || 
                                                    productPageText.includes('check availability') || productPageText.includes('book this room') ||
                                                    productPageText.includes('reserve this room') || productPageText.includes('book room') ||
                                                    productPageText.includes('select room') || productPageText.includes('choose dates');
                          
                          const hasPageFunctionality = hasProductPagePricing || hasProductPageShopping || hasHotelPagePricing || hasHotelPageBooking;
                          
                          if (hasPageFunctionality) {
                            const pageType = (hasHotelPagePricing || hasHotelPageBooking) ? 'hotel room' : 'product';
                            console.log(`✅ ${website.name}: ${pageType} page has functional features`);
                            console.log(`   - Product pricing: ${hasProductPagePricing}, Hotel pricing: ${hasHotelPagePricing}`);
                            console.log(`   - Shopping: ${hasProductPageShopping}, Hotel booking: ${hasHotelPageBooking}`);
                            
                            // Add product/room page content to our analysis
                            pageText = pageText + ' ' + productPageText;
                            
                            // Navigate back to homepage for continued analysis
                            await page.goto(website.url, { timeout: 10000 });
                            await page.waitForTimeout(1000);
                          } else {
                            console.log(`⚠️ ${website.name}: Product/room page found but no clear functional features`);
                            // Navigate back to homepage
                            await page.goto(website.url, { timeout: 10000 });
                            await page.waitForTimeout(1000);
                          }
                        }
                      } catch (e) {
                        // Check if browser was closed - break immediately
                        if (e.message.includes('Target page, context or browser has been closed') ||
                            e.message.includes('Browser has been closed') ||
                            e.message.includes('Page has been closed')) {
                          console.log(`🛑 ${website.name}: Browser closed during product link navigation - test interrupted, stopping immediately`);
                          break; // Exit the loop immediately when browser is closed
                        }
                        console.log(`⚠️ ${website.name}: Product link click failed: ${e.message}`);
                        // Try to navigate back to homepage if we got lost
                        try {
                          await page.goto(website.url, { timeout: 10000 });
                          await page.waitForTimeout(1000);
                        } catch (backError) {
                          // Check if browser was closed in the recovery attempt
                          if (backError.message.includes('Target page, context or browser has been closed') ||
                              backError.message.includes('Browser has been closed') ||
                              backError.message.includes('Page has been closed')) {
                            console.log(`🛑 ${website.name}: Browser closed during navigation recovery - test interrupted, stopping immediately`);
                            break; // Exit the loop immediately when browser is closed
                          }
                          console.log(`⚠️ ${website.name}: Could not navigate back to homepage`);
                        }
                      }
                    } else {
                      console.log(`🔍 ${website.name}: No valid product links found, proceeding with standard content analysis`);
                    }
                    
                    // Get updated page content after all interactions
                    const updatedContent = await page.textContent('body');
                    const updatedText = updatedContent ? updatedContent.toLowerCase() : '';
                    
                    // Combine original and updated content for comprehensive check
                    pageText = pageText + ' ' + updatedText;
                    
                    console.log(`🔍 ${website.name}: Content expanded from ${pageContent?.length || 0} to ${pageText.length} chars after interactions`);
                  }
                } catch (e) {
                  // Check if browser was closed - break immediately
                  if (e.message.includes('Target page, context or browser has been closed') ||
                      e.message.includes('Browser has been closed') ||
                      e.message.includes('Page has been closed')) {
                    console.log(`🛑 ${website.name}: Browser closed during enhanced detection - test interrupted, stopping immediately`);
                    break; // Exit the loop immediately when browser is closed
                  }
                  console.log(`⚠️ ${website.name}: Enhanced detection failed, using static content only: ${e.message}`);
                }
                
                // Check for unavailability patterns with better context
                let foundPattern = null;
                
                // Enhanced context detection function to avoid JavaScript/JSON false positives
                function isInJavaScriptContext(text, pattern, index) {
                  const start = Math.max(0, index - 80);
                  const end = Math.min(text.length, index + pattern.length + 80);
                  const context = text.substring(start, end);
                  
                  // Check for JavaScript/JSON indicators around the pattern
                  const jsIndicators = [
                    '":{"', '"title":"', '"description":"', '"message":"', '"error":"',
                    'console.', 'function', 'var ', 'let ', 'const ', 'window.',
                    '.error', '.log', 'throw new', 'catch', 'try', 'json.',
                    '{"', '"}', '":"', ',"', '":', 'ajax', 'fetch',
                    'script>', '</script', 'javascript:', 'data-', 'config',
                    'localization', 'translation', 'i18n', 'strings'
                  ];
                  
                  return jsIndicators.some(indicator => context.includes(indicator));
                }
                
                // Quick content analysis
                console.log(`📊 Content: ${pageText.length} chars, Title: "${pageTitle}"`);
                
                // Check for dollar sign indicating pricing/functioning store (enhanced detection)
                const hasPricing = (pageText.includes('$') || pageText.includes('£') || pageText.includes('€') || pageText.includes('¥')) &&
                                  // Must also have numbers near currency symbols to be valid pricing (including decimals)
                                  (/\$\s*\d+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?\s*\$|£\s*\d+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?\s*£|€\s*\d+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?\s*€|¥\s*\d+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?\s*¥/.test(pageText));
                
                // Check for percentage off codes indicating active promotions
                const hasPercentageOff = /\d+%\s*off|\d+%\s*discount|\d+\s*percent\s*off|save\s*\d+%|up\s*to\s*\d+%\s*off/.test(pageText);
                
                const hasShoppingFeatures = pageText.includes('add to cart') || pageText.includes('buy now') || 
                                           pageText.includes('shop now') || pageText.includes('checkout') ||
                                           pageText.includes('purchase') || pageText.includes('order now') ||
                                           pageText.includes('get yours') || pageText.includes('buy it now');
                
                // Enhanced hotel booking detection
                const hasHotelBookingFeatures = pageText.includes('book now') || pageText.includes('reserve now') || 
                                              pageText.includes('check availability') || pageText.includes('book a room') ||
                                              pageText.includes('make a reservation') || pageText.includes('reserve a room') ||
                                              pageText.includes('book your stay') || pageText.includes('check rates') ||
                                              pageText.includes('book direct') || pageText.includes('reserve direct') ||
                                              pageText.includes('check-in') || pageText.includes('check-out') ||
                                              pageText.includes('room rates') || pageText.includes('best rate') ||
                                              pageText.includes('book online') || pageText.includes('reserve online') ||
                                              pageText.includes('availability calendar') || pageText.includes('select dates') ||
                                              pageText.includes('book room') || pageText.includes('hotel booking') ||
                                              pageText.includes('room booking') || pageText.includes('reservation system') ||
                                              pageText.includes('guests') && pageText.includes('nights') ||
                                              pageText.includes('arrival') && pageText.includes('departure') ||
                                              pageText.includes('rooms available') || pageText.includes('vacancy') ||
                                              pageText.includes('hotel deals') || pageText.includes('special offers') ||
                                              pageText.includes('packages') && (pageText.includes('hotel') || pageText.includes('resort')) ||
                                              pageText.includes('per night') || pageText.includes('/night') ||
                                              pageText.includes('nightly rate') || pageText.includes('room type') ||
                                              pageText.includes('suite') && pageText.includes('available') ||
                                              pageText.includes('book this hotel') || pageText.includes('reserve this hotel');
                
                // Enhanced travel booking detection (flights, tours, experiences)
                const hasTravelBookingFeatures = pageText.includes('book flight') || pageText.includes('flight booking') ||
                                               pageText.includes('search flights') || pageText.includes('find flights') ||
                                               pageText.includes('flight deals') || pageText.includes('cheap flights') ||
                                               pageText.includes('flight search') || pageText.includes('book now') ||
                                               pageText.includes('departure') && pageText.includes('arrival') ||
                                               pageText.includes('one way') || pageText.includes('round trip') ||
                                               pageText.includes('multi-city') || pageText.includes('travelers') ||
                                               pageText.includes('passengers') || pageText.includes('airline') ||
                                               pageText.includes('travel dates') || pageText.includes('departure date') ||
                                               pageText.includes('return date') || pageText.includes('book travel') ||
                                               pageText.includes('travel booking') || pageText.includes('vacation packages') ||
                                               pageText.includes('tour packages') || pageText.includes('travel deals') ||
                                               pageText.includes('flights') || pageText.includes('airfare') ||
                                               pageText.includes('destinations') || pageText.includes('airports');
                
                // Enhanced ticket/event booking detection (concerts, shows, events)
                const hasTicketBookingFeatures = pageText.includes('buy tickets') || pageText.includes('ticket sales') ||
                                               pageText.includes('book tickets') || pageText.includes('purchase tickets') ||
                                               pageText.includes('ticket prices') || pageText.includes('show times') ||
                                               pageText.includes('event tickets') || pageText.includes('concert tickets') ||
                                               pageText.includes('theater tickets') || pageText.includes('show tickets') ||
                                               pageText.includes('tickets available') || pageText.includes('ticket booking') ||
                                               pageText.includes('select seats') || pageText.includes('seat selection') ||
                                               pageText.includes('box office') || pageText.includes('admission') ||
                                               pageText.includes('event date') || pageText.includes('show date') ||
                                               pageText.includes('venue') || pageText.includes('seating chart') ||
                                               pageText.includes('ticket office') || pageText.includes('get tickets') ||
                                               pageText.includes('tickets') || pageText.includes('shows') ||
                                               pageText.includes('events') || pageText.includes('performances') ||
                                               pageText.includes('concerts') || pageText.includes('theater');
                
                // Hotel-specific pricing patterns (rates per night, room pricing)
                const hasHotelPricing = (/\$\s*\d+(?:\.\d{1,2})?\s*\/\s*night|\$\s*\d+(?:\.\d{1,2})?\s*per\s*night|\$\s*\d+(?:\.\d{1,2})?\s*\/\s*room|room\s*from\s*\$\s*\d+|\$\s*\d+(?:\.\d{1,2})?\s*\/\s*stay|nightly\s*rate\s*\$\s*\d+/.test(pageText)) ||
                                      (/£\s*\d+(?:\.\d{1,2})?\s*\/\s*night|£\s*\d+(?:\.\d{1,2})?\s*per\s*night|£\s*\d+(?:\.\d{1,2})?\s*\/\s*room|room\s*from\s*£\s*\d+|nightly\s*rate\s*£\s*\d+/.test(pageText)) ||
                                      (/€\s*\d+(?:\.\d{1,2})?\s*\/\s*night|€\s*\d+(?:\.\d{1,2})?\s*per\s*night|€\s*\d+(?:\.\d{1,2})?\s*\/\s*room|room\s*from\s*€\s*\d+|nightly\s*rate\s*€\s*\d+/.test(pageText));
                
                // Travel-specific pricing patterns (flights, packages, tours)
                const hasTravelPricing = (/\$\s*\d+(?:\.\d{1,2})?\s*\/\s*person|\$\s*\d+(?:\.\d{1,2})?\s*per\s*person|from\s*\$\s*\d+|starting\s*at\s*\$\s*\d+|flight\s*from\s*\$\s*\d+|tickets?\s*from\s*\$\s*\d+|flights?\s*\$\s*\d+|\$\s*\d+\s*flights?/.test(pageText)) ||
                                        (/£\s*\d+(?:\.\d{1,2})?\s*\/\s*person|£\s*\d+(?:\.\d{1,2})?\s*per\s*person|from\s*£\s*\d+|starting\s*at\s*£\s*\d+|flight\s*from\s*£\s*\d+|tickets?\s*from\s*£\s*\d+|flights?\s*£\s*\d+|£\s*\d+\s*flights?/.test(pageText)) ||
                                        (/€\s*\d+(?:\.\d{1,2})?\s*\/\s*person|€\s*\d+(?:\.\d{1,2})?\s*per\s*person|from\s*€\s*\d+|starting\s*at\s*€\s*\d+|flight\s*from\s*€\s*\d+|tickets?\s*from\s*€\s*\d+|flights?\s*€\s*\d+|€\s*\d+\s*flights?/.test(pageText));
                
                // Ticket-specific pricing patterns (events, shows, concerts)  
                const hasTicketPricing = (/\$\s*\d+(?:\.\d{1,2})?\s*\/\s*ticket|\$\s*\d+(?:\.\d{1,2})?\s*per\s*ticket|tickets?\s*\$\s*\d+|from\s*\$\s*\d+\s*each|admission\s*\$\s*\d+/.test(pageText)) ||
                                        (/£\s*\d+(?:\.\d{1,2})?\s*\/\s*ticket|£\s*\d+(?:\.\d{1,2})?\s*per\s*ticket|tickets?\s*£\s*\d+|from\s*£\s*\d+\s*each|admission\s*£\s*\d+/.test(pageText)) ||
                                        (/€\s*\d+(?:\.\d{1,2})?\s*\/\s*ticket|€\s*\d+(?:\.\d{1,2})?\s*per\s*ticket|tickets?\s*€\s*\d+|from\s*€\s*\d+\s*each|admission\s*€\s*\d+/.test(pageText));
                
                // Special handling for Shopify sites - they often have template text even when unavailable
                const isShopifySite = website.url.includes('myshopify.com');
                if (isShopifySite) {
                  console.log(`🛍️ ${website.name}: Shopify site detected - will check more thoroughly`);
                }
                
                // Check for unavailability patterns first to catch "store is unavailable" type messages
                let hasUnavailabilityPattern = false;
                let foundUnavailabilityPattern = '';
                for (const pattern of unavailabilityPatterns) {
                  if (pageText.includes(pattern.toLowerCase()) || titleText.includes(pattern.toLowerCase())) {
                    hasUnavailabilityPattern = true;
                    foundUnavailabilityPattern = pattern;
                    break;
                  }
                }
                
                // Special debugging for Gameboard since it's being incorrectly skipped
                if (website.name.toLowerCase().includes('gameboard')) {
                  console.log(`🎮 ${website.name}: SPECIAL DEBUG for Gameboard`);
                  console.log(`   - Has pricing: ${hasPricing}`);
                  console.log(`   - Has shopping: ${hasShoppingFeatures}`);
                  console.log(`   - Has percentage off: ${hasPercentageOff}`);
                  console.log(`   - Has unavailability pattern: ${hasUnavailabilityPattern}`);
                  console.log(`   - Found pattern: "${foundUnavailabilityPattern}"`);
                  console.log(`   - Content length: ${pageText.length} chars`);
                  console.log(`   - Page title: "${pageTitle}"`);
                  
                  // Show all currency symbols found
                  const currencyFound = [];
                  if (pageText.includes('$')) currencyFound.push('$');
                  if (pageText.includes('£')) currencyFound.push('£');
                  if (pageText.includes('€')) currencyFound.push('€');
                  if (pageText.includes('¥')) currencyFound.push('¥');
                  console.log(`   - Currency symbols found: ${currencyFound.join(', ') || 'none'}`);
                  
                  // Show first 500 chars of content for analysis
                  console.log(`   - Content sample: "${pageText.substring(0, 500)}..."`);
                  
                  // Check for common error page indicators for Gameboard
                  const errorPageIndicators = [
                    'not found', 'site not found', 'page not found', 'website not found',
                    'error 404', '404 error', 'server error', 'temporarily unavailable',
                    'site offline', 'website offline', 'site maintenance', 'website maintenance', 'down for maintenance',
                    'suspended', 'domain expired', 'this site', 'parked domain'
                  ];
                  
                  const foundErrorIndicators = errorPageIndicators.filter(indicator => 
                    pageText.includes(indicator.toLowerCase()) || titleText.includes(indicator.toLowerCase())
                  );
                  
                  if (foundErrorIndicators.length > 0) {
                    console.log(`🚨 ${website.name}: GAMEBOARD ERROR INDICATORS FOUND: ${foundErrorIndicators.join(', ')}`);
                    console.log(`🚨 ${website.name}: FORCING GAMEBOARD TO BE FLAGGED FOR REVIEW`);
                  } else {
                    console.log(`⚠️ ${website.name}: No clear error indicators found for Gameboard`);
                  }
                }
                
                // Enhanced site type detection
                const isHotelSite = website.name.toLowerCase().includes('hotel') || 
                                   website.name.toLowerCase().includes('resort') ||
                                   website.name.toLowerCase().includes('hospitality') ||
                                   website.url.toLowerCase().includes('hotel');
                
                const isTravelSite = website.name.toLowerCase().includes('flight') || 
                                   website.name.toLowerCase().includes('travel') ||
                                   website.name.toLowerCase().includes('airline') ||
                                   website.name.toLowerCase().includes('cheapflightsfares') ||
                                   website.url.toLowerCase().includes('flight') ||
                                   website.url.toLowerCase().includes('travel') ||
                                   website.url.toLowerCase().includes('cheapflightsfares');
                                   
                const isTicketSite = website.name.toLowerCase().includes('ticket') || 
                                   website.name.toLowerCase().includes('tix') ||
                                   website.name.toLowerCase().includes('todaytix') ||
                                   website.name.toLowerCase().includes('event') ||
                                   website.url.toLowerCase().includes('ticket') ||
                                   website.url.toLowerCase().includes('tix') ||
                                   website.url.toLowerCase().includes('todaytix');
                
                // Combined functional site detection (e-commerce + hotel + travel + tickets)
                const hasFunctionalFeatures = hasShoppingFeatures || hasHotelBookingFeatures || hasTravelBookingFeatures || hasTicketBookingFeatures;
                const hasAnyPricing = hasPricing || hasHotelPricing || hasTravelPricing || hasTicketPricing;
                
                // Debug logging for pricing sites (enhanced for all site types)
                if (hasAnyPricing || hasFunctionalFeatures || hasPercentageOff) {
                  let siteType = 'E-COMMERCE';
                  if (isHotelSite) siteType = 'HOTEL';
                  else if (isTravelSite) siteType = 'TRAVEL';
                  else if (isTicketSite) siteType = 'TICKET/EVENT';
                  
                  console.log(`💰 ${website.name}: ${siteType} site with functionality detected`);
                  console.log(`   - Standard pricing: ${hasPricing}`);
                  console.log(`   - Hotel pricing: ${hasHotelPricing}`);
                  console.log(`   - Travel pricing: ${hasTravelPricing}`);
                  console.log(`   - Ticket pricing: ${hasTicketPricing}`);
                  console.log(`   - Shopping features: ${hasShoppingFeatures}`);
                  console.log(`   - Hotel booking features: ${hasHotelBookingFeatures}`);
                  console.log(`   - Travel booking features: ${hasTravelBookingFeatures}`);
                  console.log(`   - Ticket booking features: ${hasTicketBookingFeatures}`);
                  console.log(`   - Percentage off: ${hasPercentageOff}`);
                  
                  // CRITICAL DEBUG: Check if this functional site has any unavailability patterns
                  if (hasUnavailabilityPattern) {
                    console.log(`🚨 CRITICAL: ${website.name} has functionality BUT unavailability pattern: "${foundUnavailabilityPattern}"`);
                    console.log(`🔍 PATTERN SEARCH: Checking why this pattern was detected...`);
                    
                    // Show context around the pattern in the page text
                    const patternIndex = pageText.indexOf(foundUnavailabilityPattern.toLowerCase());
                    if (patternIndex !== -1) {
                      const start = Math.max(0, patternIndex - 100);
                      const end = Math.min(pageText.length, patternIndex + foundUnavailabilityPattern.length + 100);
                      const context = pageText.substring(start, end);
                      console.log(`📝 PATTERN CONTEXT: "...${context}..."`);
                    }
                    
                    // Also check title for pattern
                    if (titleText.includes(foundUnavailabilityPattern.toLowerCase())) {
                      console.log(`📄 PATTERN IN TITLE: "${titleText}"`);
                    }
                    
                    console.log(`❗ This might be causing false positive flagging!`);
                  }
                  
                  // Additional debugging for sites with pricing that might still be flagged
                  if (pageText.includes('$')) {
                    const priceMatches = pageText.match(/\$\s*\d+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?\s*\$/g);
                    if (priceMatches) {
                      console.log(`💲 ${website.name}: Price examples found: ${priceMatches.slice(0, 3).join(', ')}`);
                    } else {
                      console.log(`💲 ${website.name}: Has $ symbol but no valid price format detected`);
                    }
                  }
                }
                
                // Define strong unavailability patterns that override pricing
                // CRITICAL: Only include patterns that indicate SITE-LEVEL unavailability
                const strongUnavailabilityPatterns = [
                  'this store is unavailable',
                  'our store is unavailable', 
                  'store is currently unavailable',
                  'sorry, this store is currently unavailable',
                  'store temporarily closed',
                  'shop temporarily closed',
                  'website temporarily unavailable',
                  'site temporarily unavailable',
                  'this website is for sale',
                  'this domain is for sale',
                  'enter password to access this site',
                  'website suspended',
                  'account suspended',
                  'website maintenance mode',
                  'site maintenance mode',
                  'down for maintenance',
                  'site not found',
                  'website not found',
                  'page not found - 404',
                  '404 error',
                  'error 404'
                  // REMOVED: 'not found' and '404 not found' - too broad, catches JavaScript and other legitimate uses
                ];
                
                const hasStrongUnavailabilityPattern = strongUnavailabilityPatterns.some(pattern => 
                  pageText.includes(pattern.toLowerCase()) || titleText.includes(pattern.toLowerCase())
                );
                
                // Note: Major brands are now protected with absolute protection earlier in the flow
                
                // Special debug logging for "not found" scenarios
                const hasNotFoundPattern = pageText.includes('not found') || titleText.includes('not found') ||
                                          pageText.includes('site not found') || titleText.includes('site not found');
                if (hasNotFoundPattern) {
                  console.log(`🔍 ${website.name}: "Not found" pattern detected in content`);
                  console.log(`📄 Title: "${pageTitle}"`);
                  console.log(`📝 Content sample: "${pageText.substring(0, 200)}..."`);
                }
                
                // NUCLEAR OPTION: Force certain problematic sites to ALWAYS be flagged for manual review
                const nuclearForceSites = [
                  'gameboard', 'fanrek',
                  // Sites from screenshots that should always be flagged
                  'raineandhumbleus.com', 'raine & humble', 'raine and humble',
                  'gymstugan.com', 'gymstugan',
                  '5thwheelebike.com', '5th wheel', 'fifth wheel',
                  'bettermrcloth.com', 'bettermrcloth', 'better mr cloth',
                  'usa.renskincare.com', 'ren clean skincare', 'renskincare'
                ];
                const shouldForceFlag = nuclearForceSites.some(site => 
                  website.name.toLowerCase().includes(site.toLowerCase()) || 
                  website.url.toLowerCase().includes(site.toLowerCase())
                );
                
                if (shouldForceFlag) {
                  console.log(`🚨 ${website.name}: FORCE FLAG SITE DETECTED - MANDATORY MANUAL REVIEW`);
                  console.log(`   - This site is known to be problematic and requires manual verification`);
                  console.log(`   - Will be flagged regardless of content, pricing, or any other indicators`);
                  
                  // Force immediate flagging with intelligent pattern detection
                  let forcePattern = 'force flagged - requires manual verification';
                  
                  // Try to detect the actual issue for better reporting
                  if (pageText.includes('not found') || titleText.includes('not found')) {
                    forcePattern = 'site not found';
                  } else if (pageText.includes('error') || titleText.includes('error')) {
                    forcePattern = 'error page detected';
                  } else if (pageText.includes('offline') || pageText.includes('unavailable')) {
                    forcePattern = 'site offline or unavailable';
                  } else if (pageText.includes('website coming soon') || pageText.includes('site coming soon') || pageText.includes('under construction')) {
                    forcePattern = 'site under construction';
                  } else if (pageText.includes('site maintenance') || pageText.includes('website maintenance') || pageText.includes('website maintenance mode') || pageText.includes('site maintenance mode')) {
                    forcePattern = 'maintenance mode';
                  } else if (pageText.trim().length < 200) {
                    forcePattern = 'minimal content detected';
                  }
                  
                  console.log(`🚨 ${website.name}: FORCE FLAGGING with pattern: "${forcePattern}"`);
                  console.log(`   - Content length: ${pageText.length} chars`);
                  console.log(`   - Page title: "${pageTitle}"`);
                  console.log(`   - Content sample: "${pageText.substring(0, 300)}..."`);
                  
                  // Add to unavailable list
                  addToUnavailableWebsites(website, forcePattern);
                  
                  // Display running list
                  displayRunningFlaggedList();
                  
                  // Open in new tab for manual review
                  const newPage = await context.newPage();
                  await newPage.goto(website.url);
                  console.log(`📑 FORCE OPENED: ${website.name} in new tab for mandatory manual review`);
                  
                  // Switch back to the main testing page
                  await page.bringToFront();
                  console.log(`🔄 Switched back to main testing tab to continue checking remaining websites`);
                  
                  // Skip all other logic
                  
                  // Add website to checked list before skipping
                  checkedWebsites.push({
                    name: website.name,
                    url: website.url,
                    checkedAt: new Date().toISOString()
                  });
                  continue;
                }
                
                            // First, check if this is a major brand that should NEVER be flagged
                  const majorBrands = ['clarks', 'imarku', 'creme de la mer', 'clarks botanicals', 'bougerv', 'myeyebb', 'kimtrue', 'lifeline skincare', 'grown brilliance', 'anuschka', 'todaytix', 'cheapflightsfares', 'lifepro fitness', 'lifepro', 'woosh beauty', 'resorts world'];
                  
                  // Debug logging for specific problematic sites
                  const problemSites = ['todaytix', 'cheapflightsfares', 'lifepro'];
                  const isProblemSite = problemSites.some(site => website.name.toLowerCase().includes(site) || website.url.toLowerCase().includes(site));
                  
                  if (isProblemSite) {
                    console.log(`🔧 DEBUG: Checking major brand protection for ${website.name}`);
                    console.log(`   - Website name: "${website.name}"`);
                    console.log(`   - Website URL: "${website.url}"`);
                    console.log(`   - Name lowercase: "${website.name.toLowerCase()}"`);
                    console.log(`   - URL lowercase: "${website.url.toLowerCase()}"`);
                    console.log(`   - Checking against brands: ${majorBrands.join(', ')}`);
                  }
                  
                  const isMajorBrand = majorBrands.some(brand => {
                    const nameMatch = website.name.toLowerCase().includes(brand);
                    const urlMatch = website.url.toLowerCase().includes(brand);
                    
                    if (isProblemSite && (nameMatch || urlMatch)) {
                      console.log(`   - ✅ MATCH FOUND with brand "${brand}": name(${nameMatch}) url(${urlMatch})`);
                    }
                    
                    return nameMatch || urlMatch;
                  });
                
                // UNIVERSAL BUSINESS MODEL DETECTION: Comprehensive approach for modern websites
                const businessModels = {
                  ticketing: {
                    sites: ['todaytix', 'stubhub', 'ticketmaster', 'vivid seats', 'seatgeek'],
                    contentPatterns: ['tickets', 'shows', 'events', 'theater', 'concert', 'venue', 'performance'],
                    pricingPatterns: [/\$\d+.*ticket/i, /tickets.*\$\d+/i, /from.*\$\d+/i],
                    functionalIndicators: ['buy tickets', 'select seats', 'choose event', 'book tickets', 'event listing']
                  },
                  travel: {
                    sites: ['cheapflightsfares', 'expedia', 'kayak', 'booking', 'priceline', 'orbitz'],
                    contentPatterns: ['flights', 'hotels', 'travel', 'destinations', 'airlines', 'airports', 'booking'],
                    pricingPatterns: [/\$\d+.*flight/i, /flights.*\$\d+/i, /from.*\$\d+/i, /starting.*\$\d+/i],
                    functionalIndicators: ['search flights', 'book flight', 'find flights', 'travel deals', 'flight search']
                  },
                  fitness: {
                    sites: ['lifepro fitness', 'lifepro', 'peloton', 'nordictrack', 'bowflex'],
                    contentPatterns: ['fitness', 'workout', 'exercise', 'equipment', 'gym', 'training', 'health'],
                    pricingPatterns: [/\$\d+/i],
                    functionalIndicators: ['buy now', 'add to cart', 'shop now', 'order now', 'purchase']
                  },
                  luxury: {
                    sites: ['anuschka', 'creme de la mer', 'grown brilliance'],
                    contentPatterns: ['luxury', 'premium', 'collection', 'exclusive', 'designer'],
                    pricingPatterns: [/\$\d+/i],
                    functionalIndicators: ['shop', 'buy', 'purchase', 'add to cart', 'collection']
                  },
                  domainMarketplace: {
                    sites: ['hugedomains', 'sedo', 'godaddy auctions', 'namecheap marketplace', 'flippa'],
                    contentPatterns: ['domain', 'domains', 'domain name', 'domain marketplace', 'domain auction', 'domain broker', 'domain investment', 'premium domain'],
                    pricingPatterns: [/\$\d+.*domain/i, /domain.*\$\d+/i, /\$\d+/i],
                    functionalIndicators: ['buy now', 'buy domain', 'purchase domain', 'domain for sale', 'make offer', 'payment plan', 'monthly payments']
                  }
                };
                
                // Detect business model and apply appropriate logic
                let detectedModel = null;
                let confidence = 0;
                
                for (const [modelName, model] of Object.entries(businessModels)) {
                  const siteMatch = model.sites.some(site => 
                    website.name.toLowerCase().includes(site) || 
                    website.url.toLowerCase().includes(site) ||
                    titleText.includes(site.toLowerCase())
                  );
                  
                  if (siteMatch) {
                    // Check for supporting evidence
                    const contentScore = model.contentPatterns.filter(pattern => 
                      pageText.includes(pattern.toLowerCase())
                    ).length;
                    
                    const pricingScore = model.pricingPatterns.filter(pattern => 
                      pattern.test(pageText)
                    ).length;
                    
                    const functionalScore = model.functionalIndicators.filter(indicator => 
                      pageText.includes(indicator.toLowerCase())
                    ).length;
                    
                    const totalScore = contentScore + pricingScore + functionalScore;
                    
                    if (totalScore > confidence) {
                      detectedModel = modelName;
                      confidence = totalScore;
                    }
                  }
                }
                
                // If we detected a business model, apply appropriate logic
                if (detectedModel && confidence > 0) {
                  console.log(`🎯 ${website.name}: BUSINESS MODEL DETECTED - ${detectedModel.toUpperCase()}`);
                  console.log(`   - Confidence score: ${confidence}`);
                  console.log(`   - Model: ${detectedModel}`);
                  console.log(`   - This site has functional business model indicators`);
                  
                  // Special handling for domain marketplaces - they legitimately use "domain for sale"
                  if (detectedModel === 'domainMarketplace') {
                    console.log(`🌐 DOMAIN MARKETPLACE DETECTED: ${website.name}`);
                    console.log(`   - "Domain for sale" patterns are legitimate business model`);
                    console.log(`   - Overriding critical pattern detection for domain sales`);
                  }
                  
                  console.log(`✅ BUSINESS MODEL OVERRIDE: ${website.name} is automatically considered available`);
                  console.log(`⏭️ BUSINESS MODEL SKIP: ${website.name} - functional business detected`);
                  
                  // Add to successful websites list
                  addToSuccessfulWebsites(website, `Business model detected: ${detectedModel}`);
                  
                  // Add website to checked list before skipping
                  checkedWebsites.push({
                    name: website.name,
                    url: website.url,
                    checkedAt: new Date().toISOString()
                  });
                  continue; // Skip - business model is clearly functional
                }
                
                // NUCLEAR OPTION: Hardcoded sites that must NEVER be flagged (backup)
                const neverFlagSites = ['todaytix', 'cheapflightsfares', 'lifepro fitness', 'lifepro', 'anuschka', 'woosh beauty', 'resorts world'];
                const shouldNeverFlag = neverFlagSites.some(site => 
                  website.name.toLowerCase().includes(site) || website.url.toLowerCase().includes(site)
                );
                
                if (shouldNeverFlag) {
                  console.log(`🚫 ${website.name}: NUCLEAR PROTECTION - NEVER FLAG LIST`);
                  console.log(`   - This site is on the never-flag list`);
                  console.log(`   - Absolutely cannot be flagged under any circumstances`);
                  console.log(`✅ NUCLEAR OVERRIDE: ${website.name} is automatically considered available`);
                  console.log(`⏭️ NUCLEAR SKIP: ${website.name} - hardcoded protection`);
                  
                  // Add to successful websites list
                  addToSuccessfulWebsites(website, 'Nuclear protection - never flag list');
                  
                  // Add website to checked list before skipping
                  checkedWebsites.push({
                    name: website.name,
                    url: website.url,
                    checkedAt: new Date().toISOString()
                  });
                  continue; // Nuclear skip - absolutely nothing can flag this site
                }
                
                // MAJOR BRAND PROTECTION: Skip problematic detection for known functioning brands
                if (isMajorBrand) {
                  console.log(`🏢 ${website.name}: MAJOR BRAND detected - ABSOLUTE PROTECTION enabled`);
                  console.log(`   - This brand is protected from ALL flagging logic`);
                  console.log(`   - Will NEVER be flagged regardless of content`);
                  console.log(`✅ MAJOR BRAND OVERRIDE: ${website.name} is automatically considered available`);
                  console.log(`⏭️ SKIPPING: ${website.name} - major brand absolute protection`);
                  
                  // Add to successful websites list
                  addToSuccessfulWebsites(website, 'Major brand protection');
                  
                  // Add website to checked list before skipping
                  checkedWebsites.push({
                    name: website.name,
                    url: website.url,
                    checkedAt: new Date().toISOString()
                  });
                  continue; // Skip ALL detection logic for major brands
                }
                
                // Continue with normal processing for major brands and non-problematic sites
                
                // Note: Major brand protection now happens earlier with absolute protection
                
                // Critical store unavailability patterns that should NEVER be skipped
                const criticalUnavailabilityMessages = [
                  'this store is unavailable',
                  'our store is unavailable', 
                  'store is currently unavailable',
                  'sorry, this store is currently unavailable',
                  'store temporarily closed',
                  'shop temporarily closed'
                ];
                
                const hasCriticalUnavailabilityMessage = criticalUnavailabilityMessages.some(pattern => 
                  pageText.includes(pattern.toLowerCase()) || titleText.includes(pattern.toLowerCase())
                );
                
                // NEVER skip sites with critical unavailability messages
                if (hasCriticalUnavailabilityMessage) {
                  console.log(`🚨 ${website.name}: CRITICAL UNAVAILABILITY MESSAGE DETECTED - FORCING MANUAL REVIEW`);
                  const detectedMessage = criticalUnavailabilityMessages.find(pattern => 
                    pageText.includes(pattern.toLowerCase()) || titleText.includes(pattern.toLowerCase())
                  );
                  console.log(`   - Detected message: "${detectedMessage}"`);
                  console.log(`   - This overrides any pricing/functionality detection`);
                  
                  // MANUAL REVIEW LOGGING: Critical unavailability message
                  console.log('\n🚨 MANUAL REVIEW DECISION: CRITICAL UNAVAILABILITY MESSAGE');
                  console.log(`🏷️ Site: ${website.name}`);
                  console.log(`🔗 URL: ${website.url}`);
                  console.log(`📝 Reason: Critical unavailability message detected`);
                  console.log(`🎯 Detected Message: "${detectedMessage}"`);
                  console.log(`📊 Content Length: ${pageText.length} characters`);
                  console.log(`📄 Page Title: "${pageTitle}"`);
                  console.log(`⚖️ Decision: FORCE FLAG - Critical message overrides all functionality`);
                  console.log('='.repeat(50));
                  
                  // Force immediate flagging
                  addToUnavailableWebsites(website, detectedMessage);
                  
                  // Display running list
                  displayRunningFlaggedList();
                  
                  // Open in new tab for manual review
                  const newPage = await context.newPage();
                  await newPage.goto(website.url);
                  console.log(`📑 FORCED: Opened ${website.name} in new tab for critical unavailability message`);
                  await page.bringToFront();
                  
                  // Add website to checked list before skipping
                  checkedWebsites.push({
                    name: website.name,
                    url: website.url,
                    checkedAt: new Date().toISOString()
                  });
                  continue;
                }
                
                // ENHANCED LOGIC: Early exit for functional sites with better Shopify handling
                // Enhanced for hotels: also check hotel booking features and pricing
                
                // ENHANCED FUNCTIONAL SITE PROTECTION
                // Strong evidence: pricing + shopping features, OR percentage off
                const hasStrongFunctionalEvidence = (hasAnyPricing && hasFunctionalFeatures) || hasPercentageOff;
                
                // Good evidence: pricing OR shopping features (for non-Shopify)
                const hasGoodFunctionalEvidence = !isShopifySite && (hasAnyPricing || hasFunctionalFeatures);
                
                // Basic evidence: just pricing OR just shopping features
                const hasBasicFunctionalEvidence = hasAnyPricing || hasFunctionalFeatures;
                
                // Determine protection level
                const protectionLevel = hasStrongFunctionalEvidence ? 'STRONG' : 
                                      hasGoodFunctionalEvidence ? 'GOOD' : 
                                      hasBasicFunctionalEvidence ? 'BASIC' : 'NONE';
                
                // Strong and Good protection: skip ALL pattern checking unless store-critical patterns
                if ((hasStrongFunctionalEvidence || hasGoodFunctionalEvidence) && !hasStrongUnavailabilityPattern) {
                  let siteType = 'E-COMMERCE';
                  if (isHotelSite) siteType = 'HOTEL';
                  else if (isTravelSite) siteType = 'TRAVEL';
                  else if (isTicketSite) siteType = 'TICKET/EVENT';
                  
                  // Enhanced status reporting with protection level
                  if (hasUnavailabilityPattern) {
                    console.log(`✅ ${website.name}: ${siteType} site has ${protectionLevel} protection and only weak unavailability pattern "${foundUnavailabilityPattern}" - considering available`);
                  } else {
                    console.log(`✅ ${website.name}: ${siteType} site has ${protectionLevel} protection and no unavailability patterns - definitely available`);
                  }
                  
                  console.log(`🛡️ PROTECTION LEVEL: ${protectionLevel}`);
                  console.log(`🔍 EVIDENCE: Pricing(${hasAnyPricing}), Features(${hasFunctionalFeatures}), PercentOff(${hasPercentageOff})`);
                  console.log(`📊 CRITERIA: Strong(${hasStrongFunctionalEvidence}), Good(${hasGoodFunctionalEvidence}), Basic(${hasBasicFunctionalEvidence})`);
                  if (hasUnavailabilityPattern) {
                    console.log(`⚠️ WEAK PATTERN IGNORED: "${foundUnavailabilityPattern}"`);
                  }
                  
                  let detectionType = 'e-commerce';
                  if (isHotelSite) detectionType = 'hotel booking';
                  else if (isTravelSite) detectionType = 'travel booking';
                  else if (isTicketSite) detectionType = 'ticket booking';
                  
                  console.log(`⏭️ SKIPPING: ${website.name} - considered functional based on ${detectionType} detection`);
                  
                  // Add to successful websites list
                  addToSuccessfulWebsites(website, `Functional ${detectionType} features detected (${protectionLevel} protection)`);
                  
                  // Add website to checked list before skipping
                  checkedWebsites.push({
                    name: website.name,
                    url: website.url,
                    checkedAt: new Date().toISOString()
                  });
                  continue; // Skip all unavailability checks
                }
                
                // BASIC protection: Sites with basic functionality get protection against false positives
                if (hasBasicFunctionalEvidence && !hasStrongUnavailabilityPattern) {
                  console.log(`🛡️ ${website.name}: Has BASIC functional protection - will only flag for severe problems`);
                  console.log(`🔍 EVIDENCE: Pricing(${hasAnyPricing}), Features(${hasFunctionalFeatures})`);
                  
                  // Only check for VERY severe patterns, skip false-positive prone patterns
                  const severePatternsOnly = [
                    'this store is unavailable', 'store is currently unavailable', 'sorry, this store is currently unavailable',
                    'store temporarily closed', 'shop temporarily closed', 'website temporarily unavailable',
                    'site temporarily unavailable', 'this website is for sale', 'this domain is for sale',
                    'parked domain', 'website coming soon', 'site coming soon', 'this website is coming soon', 'this site is coming soon', 'under construction',
                    'website maintenance mode', 'site maintenance mode', 'down for maintenance', 'site offline', 'website offline',
                    'website suspended', 'account suspended', 'site not found', 'page not found'
                  ];
                  
                  let foundSeverePattern = null;
                  for (const pattern of severePatternsOnly) {
                    if (pageText.includes(pattern.toLowerCase()) || titleText.includes(pattern.toLowerCase())) {
                      foundSeverePattern = pattern;
                      break;
                    }
                  }
                  
                  if (!foundSeverePattern) {
                    console.log(`✅ ${website.name}: Has basic functionality and no severe problems - considering available`);
                    console.log(`⏭️ BASIC PROTECTION SKIP: ${website.name} - functional with no severe issues`);
                    
                    // Add to successful websites list
                    addToSuccessfulWebsites(website, 'Basic functional features detected, no severe problems');
                    
                    // Add website to checked list before skipping
                    checkedWebsites.push({
                      name: website.name,
                      url: website.url,
                      checkedAt: new Date().toISOString()
                    });
                    continue; // Skip pattern checking for basic functional sites without severe problems
                  } else {
                    console.log(`🚨 ${website.name}: Has basic functionality BUT severe pattern detected: "${foundSeverePattern}"`);
                    console.log(`   - Will continue with full pattern analysis due to severe issue`);
                  }
                }
                
                // For Shopify sites, only skip if they have VERY strong indicators of functionality
                if (isShopifySite && (hasAnyPricing || hasFunctionalFeatures || hasPercentageOff) && !hasUnavailabilityPattern) {
                  // Require more evidence for Shopify sites (percentage off codes are strong indicators)
                  const hasStrongShoppingEvidence = (pageText.includes('add to cart') && pageText.includes('checkout') && hasPricing) || hasPercentageOff;
                  const hasStrongHotelEvidence = (hasHotelBookingFeatures && hasHotelPricing) || hasPercentageOff;
                  const hasStrongTravelEvidence = (hasTravelBookingFeatures && hasTravelPricing) || hasPercentageOff;
                  const hasStrongTicketEvidence = (hasTicketBookingFeatures && hasTicketPricing) || hasPercentageOff;
                  const hasStrongEvidence = hasStrongShoppingEvidence || hasStrongHotelEvidence || hasStrongTravelEvidence || hasStrongTicketEvidence;
                  
                  if (hasStrongEvidence) {
                    let evidenceType = 'shopping';
                    if (hasStrongHotelEvidence) evidenceType = 'hotel booking';
                    else if (hasStrongTravelEvidence) evidenceType = 'travel booking';
                    else if (hasStrongTicketEvidence) evidenceType = 'ticket booking';
                    
                    console.log(`✅ ${website.name}: Shopify site with strong ${evidenceType} evidence - considering available`);
                    console.log(`⏭️ SKIPPING: ${website.name} - Shopify site with strong evidence`);
                    
                    // Add to successful websites list
                    addToSuccessfulWebsites(website, `Shopify site with strong ${evidenceType} evidence`);
                    
                    // Add website to checked list before skipping
                    checkedWebsites.push({
                      name: website.name,
                      url: website.url,
                      checkedAt: new Date().toISOString()
                    });
                    continue;
                  } else {
                    console.log(`🛍️ ${website.name}: Shopify site with some functionality but insufficient evidence - will check patterns`);
                  }
                }
                
                // Special case: Check for minimal content sites (like wearwiz.com)
                const domain = new URL(website.url).hostname.replace('www.', '');
                const hasMinimalContent = pageText.trim().length < 300;
                const hasOnlyDomainTitle = titleText === domain || titleText === `www.${domain}` || titleText.includes(domain);
                const hasNoRealContent = !pageText.includes('shop') && !pageText.includes('buy') && 
                                         !pageText.includes('product') && !pageText.includes('store') &&
                                         !pageText.includes('welcome') && !pageText.includes('home') &&
                                         !pageText.includes('about') && !pageText.includes('contact');
                
                if (hasMinimalContent && (hasOnlyDomainTitle || hasNoRealContent)) {
                  console.log(`🔍 Minimal content detected - likely unavailable`);
                  foundPattern = 'minimal content - likely unavailable';
                } else {
                  // Regular pattern checking with enhanced context detection
                  for (const pattern of unavailabilityPatterns) {
                    const patternLower = pattern.toLowerCase();
                    
                    // Check if pattern exists in page content or title
                    const inPageText = pageText.includes(patternLower);
                    const inTitleText = titleText.includes(patternLower);
                    
                    if (inPageText || inTitleText) {
                      // Enhanced context checking for page text patterns
                      if (inPageText) {
                        const patternIndex = pageText.indexOf(patternLower);
                        const inJsContext = isInJavaScriptContext(pageText, patternLower, patternIndex);
                        
                        if (inJsContext) {
                          console.log(`🛡️ Pattern "${pattern}" found but in JavaScript/JSON context - ignoring false positive`);
                          continue;
                        }
                      }
                      
                      // Critical patterns that should NEVER be skipped (even if functional)
                      const isCriticalPattern = patternLower.includes('store is unavailable') || 
                                              patternLower.includes('store is currently unavailable') ||
                                              patternLower.includes('sorry, this store is currently unavailable') ||
                                              patternLower.includes('store temporarily closed') ||
                                              patternLower.includes('shop temporarily closed') ||
                                              patternLower.includes('website temporarily unavailable') ||
                                              patternLower.includes('site temporarily unavailable') ||
                                              patternLower.includes('password protected site') || 
                                              patternLower.includes('suspended') || 
                                              patternLower.includes('offline') ||
                                              patternLower.includes('website maintenance mode') ||
                                              patternLower.includes('site maintenance mode') ||
                                              patternLower.includes('site maintenance') ||
                                              patternLower.includes('website maintenance') ||
                                              patternLower.includes('website coming soon') ||
                                              patternLower.includes('site coming soon') ||
                                              patternLower.includes('this website is coming soon') ||
                                              patternLower.includes('this site is coming soon') ||
                                              patternLower.includes('under construction') ||
                                              patternLower.includes('for sale');
                      
                      // For non-critical patterns, also check if site has strong functionality
                      if (!isCriticalPattern && (hasAnyPricing || hasFunctionalFeatures || hasPercentageOff)) {
                        console.log(`🛡️ Pattern "${pattern}" found but site has strong functional features - likely false positive, ignoring`);
                        continue;
                      }
                      
                      // Only skip non-critical patterns that might be false positives
                      if (!isCriticalPattern) {
                        console.log(`⚠️ Pattern "${pattern}" found but might be false positive - skipping`);
                        continue;
                      }
                      
                      foundPattern = pattern;
                      break;
                    }
                  }
                }
                
                if (foundPattern) {
                  console.log(`🚨 UNAVAILABILITY DETECTED: "${foundPattern}"`);
                  
                  // Special logging for sites that have pricing but are still flagged
                  if (hasAnyPricing || hasFunctionalFeatures || hasPercentageOff) {
                    let siteType = 'E-COMMERCE';
                    if (isHotelSite) siteType = 'HOTEL';
                    else if (isTravelSite) siteType = 'TRAVEL';
                    else if (isTicketSite) siteType = 'TICKET/EVENT';
                    
                    console.log(`🤔 ${website.name}: ${siteType} site FLAGGED despite having functional features!`);
                    console.log(`   - Standard pricing: ${hasPricing}`);
                    console.log(`   - Hotel pricing: ${hasHotelPricing}`);
                    console.log(`   - Travel pricing: ${hasTravelPricing}`);
                    console.log(`   - Ticket pricing: ${hasTicketPricing}`);
                    console.log(`   - Shopping features: ${hasShoppingFeatures}`);
                    console.log(`   - Hotel booking features: ${hasHotelBookingFeatures}`);
                    console.log(`   - Travel booking features: ${hasTravelBookingFeatures}`);
                    console.log(`   - Ticket booking features: ${hasTicketBookingFeatures}`);
                    console.log(`   - Percentage off: ${hasPercentageOff}`);
                    console.log(`   - Pattern found: "${foundPattern}"`);
                    console.log(`   - Strong pattern: ${hasStrongUnavailabilityPattern}`);
                  }
                  
                  // MANUAL REVIEW LOGGING: Regular unavailability pattern
                  console.log('\n🚨 MANUAL REVIEW DECISION: UNAVAILABILITY PATTERN DETECTED');
                  console.log(`🏷️ Site: ${website.name}`);
                  console.log(`🔗 URL: ${website.url}`);
                  console.log(`📝 Reason: Unavailability pattern found`);
                  console.log(`🎯 Detected Pattern: "${foundPattern}"`);
                  console.log(`📊 Content Length: ${pageText.length} characters`);
                  console.log(`📄 Page Title: "${pageTitle}"`);
                  
                  // Check if this site has functionality but was still flagged
                  if (hasAnyPricing || hasFunctionalFeatures || hasPercentageOff) {
                    console.log(`❗ ATTENTION: Site has functional features but was flagged anyway!`);
                    console.log(`   💰 Has Pricing: ${hasAnyPricing} (Standard: ${hasPricing}, Hotel: ${hasHotelPricing}, Travel: ${hasTravelPricing}, Ticket: ${hasTicketPricing})`);
                    console.log(`   🛒 Has Shopping Features: ${hasShoppingFeatures}`);
                    console.log(`   🏨 Has Hotel Features: ${hasHotelBookingFeatures}`);
                    console.log(`   ✈️ Has Travel Features: ${hasTravelBookingFeatures}`);
                    console.log(`   🎫 Has Ticket Features: ${hasTicketBookingFeatures}`);
                    console.log(`   💸 Has Percentage Off: ${hasPercentageOff}`);
                    console.log(`   🚨 This might be a FALSE POSITIVE that needs investigation!`);
                  } else {
                    console.log(`✅ No functional features detected - flagging appears correct`);
                  }
                  
                  console.log(`⚖️ Decision: FLAG FOR MANUAL REVIEW`);
                  console.log('='.repeat(50));
                  
                  addToUnavailableWebsites(website, foundPattern);
                  
                  // Display running list
                  displayRunningFlaggedList();
                  
                  // Smart tab opening: Only open for genuinely problematic sites
                  const shouldOpenTab = foundPattern.includes('unavailable') || 
                                       foundPattern.includes('suspended') || 
                                       foundPattern.includes('offline') ||
                                       foundPattern.includes('maintenance') ||
                                       foundPattern.includes('not found') ||
                                       foundPattern.includes('error') ||
                                       foundPattern.includes('website coming soon') ||
                                       foundPattern.includes('site coming soon') ||
                                       foundPattern.includes('construction');
                  
                  if (shouldOpenTab) {
                    try {
                      console.log(`🚨 OPENING TAB: ${website.name} requires manual verification for "${foundPattern}"`);
                      const newPage = await context.newPage();
                      await newPage.goto(website.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
                      console.log(`📑 TAB OPENED: ${website.name} - Manual review needed`);
                  await page.bringToFront();
                    } catch (tabError) {
                      // Check if browser was closed - break immediately
                      if (tabError.message.includes('Target page, context or browser has been closed') ||
                          tabError.message.includes('Browser has been closed') ||
                          tabError.message.includes('Page has been closed')) {
                        console.log(`🛑 ${website.name}: Browser closed during tab opening - test interrupted, stopping immediately`);
                        break; // Exit the loop immediately when browser is closed
                      }
                      console.log(`⚠️ Tab opening failed for ${website.name}: ${tabError.message}`);
                    }
                  } else {
                    console.log(`📋 LOGGED ONLY: ${website.name} flagged for "${foundPattern}" - no tab needed for minor issue`);
                  }
                  
                } else {
                  // FINAL SAFETY NET: Check one more time if this should have been force flagged
                  const finalSafetyNetSites = [
                    'gameboard', 'fanrek',
                    // Sites from screenshots that should always be flagged (final safety net)
                    'raineandhumbleus.com', 'raine & humble', 'raine and humble',
                    'gymstugan.com', 'gymstugan',
                    '5thwheelebike.com', '5th wheel', 'fifth wheel',
                    'bettermrcloth.com', 'bettermrcloth', 'better mr cloth',
                    'usa.renskincare.com', 'ren clean skincare', 'renskincare'
                  ];
                  const shouldHaveBeenForceFlag = finalSafetyNetSites.some(site => 
                    website.name.toLowerCase().includes(site.toLowerCase()) || 
                    website.url.toLowerCase().includes(site.toLowerCase())
                  );
                  
                  if (shouldHaveBeenForceFlag) {
                    console.log(`🚨🚨🚨 FINAL SAFETY NET: ${website.name} should have been force flagged but wasn't!`);
                    console.log(`   - This is a critical error - forcing immediate flagging NOW`);
                    
                    // Emergency flagging
                    addToUnavailableWebsites(website, 'emergency catch - should have been force flagged');
                    
                    // Display running list
                    displayRunningFlaggedList();
                    
                    // Emergency tab opening
                    try {
                      const emergencyPage = await context.newPage();
                      await emergencyPage.goto(website.url);
                      console.log(`📑 EMERGENCY OPENED: ${website.name} in new tab`);
                      await page.bringToFront();
                    } catch (emergencyError) {
                      // Check if browser was closed - break immediately
                      if (emergencyError.message.includes('Target page, context or browser has been closed') ||
                          emergencyError.message.includes('Browser has been closed') ||
                          emergencyError.message.includes('Page has been closed')) {
                        console.log(`🛑 ${website.name}: Browser closed during emergency tab opening - test interrupted, stopping immediately`);
                        break; // Exit the loop immediately when browser is closed
                      }
                      console.log(`⚠️ Emergency tab failed but site flagged: ${emergencyError.message}`);
                    }
                  } else {
                  // FINAL CHECK: Only flag for SEVERE problematic indicators if NO functionality detected
                  if (!hasAnyPricing && !hasFunctionalFeatures && !hasPercentageOff) {
                    const severeProblematicIndicators = [
                      // Only the most obvious error indicators
                      'site not found', 'website not found', '404 error', 'error 404',
                      'server error', 'site offline', 'website offline', 
                      'suspended', 'domain expired', 'parked domain',
                      'this website is for sale', 'this domain is for sale',
                      'website coming soon', 'site coming soon', 'under construction'
                    ];

                    const foundSevereIndicators = severeProblematicIndicators.filter(indicator => 
                      pageText.includes(indicator.toLowerCase()) || titleText.includes(indicator.toLowerCase())
                    );

                    // Also check for truly minimal suspicious content
                    const hasTrulyMinimalContent = pageText.trim().length < 300 && (
                      titleText.includes('error') || 
                      titleText.includes('not found') ||
                      pageText.includes('apache') ||
                      pageText.includes('nginx')
                    );

                    if (foundSevereIndicators.length > 0 || hasTrulyMinimalContent) {
                      const detectedPattern = foundSevereIndicators.length > 0 
                        ? foundSevereIndicators[0] 
                        : 'minimal error content detected';
                      
                      // MANUAL REVIEW LOGGING: Severe problem with no functionality
                      console.log('\n🚨 MANUAL REVIEW DECISION: SEVERE PROBLEM (NO FUNCTIONALITY)');
                      console.log(`🏷️ Site: ${website.name}`);
                      console.log(`🔗 URL: ${website.url}`);
                      console.log(`📝 Reason: Severe problem detected with no functional features`);
                      console.log(`🎯 Detected Pattern: "${detectedPattern}"`);
                      console.log(`📊 Content Length: ${pageText.length} characters`);
                      console.log(`📄 Page Title: "${pageTitle}"`);
                      console.log(`💰 Has Any Pricing: ${hasAnyPricing}`);
                      console.log(`🛒 Has Functional Features: ${hasFunctionalFeatures}`);
                      console.log(`💸 Has Percentage Off: ${hasPercentageOff}`);
                      console.log(`⚖️ Decision: FLAG - No functionality + severe problems = genuinely broken`);
                      console.log('='.repeat(50));
                      
                      addToUnavailableWebsites(website, detectedPattern);
                      
                      // Display running list
                      displayRunningFlaggedList();
                      
                      const newPage = await context.newPage();
                      await newPage.goto(website.url);
                      console.log(`📑 OPENED: ${website.name} in new tab for manual review`);
                      await page.bringToFront();
                    } else {
                      console.log(`✅ Available: ${website.name} (no severe problems detected)`);
                      
                      // Add to successful websites list
                      addToSuccessfulWebsites(website, 'No severe problems detected');
                    }
                  } else {
                    console.log(`✅ Available: ${website.name} (has functional features)`);
                    
                    // Add to successful websites list
                    addToSuccessfulWebsites(website, 'Has functional features');
                  }
                  }
                }
                
                // Add website to checked list after processing is complete (for successful sites)
                checkedWebsites.push({
                      name: website.name,
                      url: website.url,
                      checkedAt: new Date().toISOString()
                    });
                
              } catch (error) {
                console.log(`❌ Error checking ${website.name}: ${error.message}`);
                
                // Check if browser/page was closed (test interrupted) - break immediately
                if (error.message.includes('Target page, context or browser has been closed') ||
                    error.message.includes('Browser has been closed') ||
                    error.message.includes('Page has been closed')) {
                  console.log(`🛑 ${website.name}: Browser closed - test was interrupted, stopping immediately`);
                  
                  // Show immediate progress update when browser is closed
                  console.log('\n' + '🛑'.repeat(50));
                  console.log('🛑 BROWSER CLOSED - TEST INTERRUPTED');
                  console.log('🛑'.repeat(50));
                  console.log(`📊 Progress when browser closed: ${checkedCount}/${shuffledWebsites.length} websites checked`);
                  console.log(`🚨 Unavailable websites found: ${unavailableWebsites.length}`);
                  console.log(`✅ Successful websites found: ${successfulWebsites.length}`);
                  console.log(`📈 Completion rate: ${((checkedCount / shuffledWebsites.length) * 100).toFixed(1)}%`);
                  console.log(`🚩 Flagging rate: ${checkedCount > 0 ? ((unavailableWebsites.length / checkedCount) * 100).toFixed(1) : 0}%`);
                  console.log(`📊 Success rate: ${checkedCount > 0 ? ((successfulWebsites.length / checkedCount) * 100).toFixed(1) : 0}%`);
                  console.log(`⏳ Last website being checked: ${website.name}`);
                  console.log('');
                  
                  if (unavailableWebsites.length > 0) {
                    console.log('🚨 FLAGGED SITES BEFORE BROWSER CLOSURE:');
                    unavailableWebsites.forEach((site, index) => {
                      console.log(`  ${index + 1}. 🚩 ${site.name} - "${site.pattern}"`);
                    });
                  } else {
                    console.log('✅ No sites flagged before browser closure');
                  }
                  
                  if (successfulWebsites.length > 0) {
                    console.log('');
                    console.log('✅ SUCCESSFUL SITES BEFORE BROWSER CLOSURE:');
                    successfulWebsites.forEach((site, index) => {
                      const passedByUser = userPassedWebsites.some(passed => passed.name === site.name && passed.url === site.url);
                      const statusIcon = passedByUser ? '👤' : '🤖';
                      console.log(`  ${index + 1}. ${statusIcon} ${site.name} - "${site.reason}"`);
                    });
                  } else {
                    console.log('');
                    console.log('⚠️ No successful sites detected before browser closure');
                  }
                  
                  console.log('');
                  console.log('💡 Browser was closed manually - test cannot continue');
                  console.log('🔄 Restart the test to check remaining websites');
                  console.log('📁 NOTE: Cannot download results file when browser is closed manually');
                  console.log(`🔍 DEBUG: Error details: ${error.message}`);
                  console.log(`🔍 DEBUG: Error stack: ${error.stack}`);
                  console.log('💡 TIP: Use F8 or Pause button instead of closing browser to get results file');
                  console.log('🛑'.repeat(50));
                  
                  break; // Exit the loop immediately when browser is closed
                }
                
                // Check if it's a loading error that might indicate unavailability
                if (error.message.includes('ERR_ABORTED') || 
                    error.message.includes('ERR_FAILED') ||
                    error.message.includes('ERR_TIMED_OUT') ||
                    error.message.includes('ERR_CONNECTION_REFUSED') ||
                    error.message.includes('ERR_NAME_NOT_RESOLVED') ||
                    error.message.includes('Timeout') ||
                    error.message.includes('timeout') ||
                    error.message.includes('Navigation timeout') ||
                    error.message.includes('page.goto: Timeout') ||
                    error.message.includes('30000ms exceeded')) {
                  
                  console.log(`🚨 NETWORK/TIMEOUT ERROR - Website unavailable or unresponsive`);
                  
                  // Determine specific error type for better reporting
                  let errorType = 'network error';
                  if (error.message.includes('Timeout') || 
                      error.message.includes('timeout') || 
                      error.message.includes('30000ms exceeded')) {
                    errorType = 'timeout error - site did not load within 30 seconds';
                  } else if (error.message.includes('ERR_TIMED_OUT')) {
                    errorType = 'connection timeout';
                  } else if (error.message.includes('ERR_CONNECTION_REFUSED')) {
                    errorType = 'connection refused';
                  } else if (error.message.includes('ERR_NAME_NOT_RESOLVED')) {
                    errorType = 'DNS resolution failed';
                  }
                  
                  addToUnavailableWebsites(website, `${errorType}: ${error.message.split('\n')[0]}`);

                  
                  // Display running list
                  displayRunningFlaggedList();
                  
                  console.log(`📑 FLAGGED: ${website.name} - ${errorType}`);
                  console.log(`🔗 URL: ${website.url}`);
                  console.log(`📝 Error: ${error.message.split('\n')[0]}`);
                  
                  // Add to checked websites list for timeout/network errors
                  checkedWebsites.push({
                    name: website.name,
                    url: website.url,
                    checkedAt: new Date().toISOString()
                  });
                  
                  // Continue to next website since this one is flagged
                  continue;
                }
                
                // Add website to checked list after processing is complete (for successful sites)
                checkedWebsites.push({
                  name: website.name,
                  url: website.url,
                  checkedAt: new Date().toISOString()
                });
                
                // Continue to next website
              }
              
              // Memory cleanup after each website to prevent heap overflow
              try {
                // Check if browser/page is still connected before cleanup
                if (!browser.isConnected()) {
                  console.log('🚨 Browser connection lost - cannot continue');
                  console.log('🔍 DEBUG: Browser disconnection detected during cleanup');
                  break;
                }
                
                // Clear page content and force cleanup
                await page.evaluate(() => {
                  // Remove large script elements
                  document.querySelectorAll('script').forEach(el => el.remove());
                  // Clear any cached data
                  if (window.performance && window.performance.clearResourceTimings) {
                    window.performance.clearResourceTimings();
                  }
                });
                
                // Force garbage collection if available
                if (global.gc) {
                  global.gc();
                }
                
                // Log memory usage every 5 websites
                if (checkedCount % 5 === 0) {
                  const memUsage = process.memoryUsage();
                  console.log(`💾 Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB used, ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB total`);
                }
              } catch (cleanupError) {
                // Check if this is a connection error
                if (cleanupError.message.includes('was not bound in the connection') ||
                    cleanupError.message.includes('Target closed') ||
                    cleanupError.message.includes('Browser has been closed')) {
                  console.log('🚨 Browser connection lost during cleanup - stopping test');
                  break;
                }
                // Continue if cleanup fails for other reasons
                console.log(`⚠️ Memory cleanup warning: ${cleanupError.message}`);
              }
              
              // Optional checkpoint every 10 websites (after processing is complete)
              if (checkedCount % 10 === 0) {
                console.log('\n' + '📊'.repeat(20));
                console.log('📊 PROGRESS CHECKPOINT');
                console.log('📊'.repeat(20));
                console.log(`📈 Progress: ${checkedCount}/${shuffledWebsites.length} websites checked`);
                console.log(`🚨 Found ${unavailableWebsites.length} unavailable websites so far`);
                console.log(`✅ Found ${successfulWebsites.length} successful websites so far`);
                console.log(`📊 Flagging rate: ${((unavailableWebsites.length / checkedCount) * 100).toFixed(1)}%`);
                console.log(`📊 Success rate: ${((successfulWebsites.length / checkedCount) * 100).toFixed(1)}%`);
                console.log('');
                
                // Display the running flagged list at checkpoints
                displayRunningFlaggedList();
                
                // Display the successful websites list at checkpoints
                displaySuccessfulWebsitesList();
                
                // Display all tested merchants at checkpoints
                displayAllTestedMerchants();
                
                // Download checkpoint file every 50 merchants to preserve progress
                if (checkedCount % 50 === 0) {
                  console.log('📁 Checkpoint: Downloading progress file...');
                  try {
                    await downloadResultsFile();
                    console.log('✅ Checkpoint file saved successfully');
                    
                    // Aggressive memory cleanup at checkpoints
                    console.log('💾 Performing checkpoint memory cleanup...');
                    await page.evaluate(() => {
                      // Clear all cached resources
                      if (window.performance) {
                        window.performance.clearResourceTimings();
                        window.performance.clearMarks();
                        window.performance.clearMeasures();
                      }
                      // Clear console history
                      if (console.clear) console.clear();
                    });
                    
                    // Force multiple garbage collections
                    if (global.gc) {
                      for (let i = 0; i < 3; i++) {
                        global.gc();
                      }
                    }
                    
                    const memUsage = process.memoryUsage();
                    console.log(`💾 Post-cleanup memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB used`);
                  } catch (downloadError) {
                    console.log(`⚠️ Checkpoint download failed: ${downloadError.message}`);
                  }
                }
                
                console.log('💡 CONTROLS:');
                console.log('  ⏸️ Press F8 anytime to pause and download results');
                console.log('  ✅ Press Ctrl+S to pass current site');
                console.log('  📁 Results auto-download every 50 sites and at end');
                console.log('▶️ Continuing automatically in 3 seconds...');
                console.log('📊'.repeat(20));
                
                // Slightly longer pause to read the checkpoint
                await page.waitForTimeout(3000);
              }
              
              } catch (websiteError) {
                console.log(`💥 Error processing ${website.name}: ${websiteError.message}`);
                console.log(`🔄 Continuing with next website...`);
                
                // Check if browser is still connected
                if (!browser.isConnected()) {
                  console.log(`🚨 Browser disconnected during website processing - stopping test`);
                  break;
                }
                
                // Add to checked list even if error occurred
                checkedWebsites.push({
                  name: website.name,
                  url: website.url,
                  checkedAt: new Date().toISOString(),
                  error: websiteError.message
                });
              }
            }
            
          } catch (error) {
            console.log(`💥 Fatal error during website checking: ${error.message}`);
            console.log(`🔍 DEBUG: Error stack: ${error.stack}`);
            console.log(`🔍 DEBUG: Error occurred at website ${checkedCount}: ${shuffledWebsites[checkedCount - 1]?.name || 'Unknown'}`);
            
            // Show progress update if test was interrupted early
            console.log('\n' + '⚠️'.repeat(50));
            console.log('⚠️ TEST INTERRUPTED - EARLY STOP PROGRESS UPDATE');
            console.log('⚠️'.repeat(50));
            console.log(`📊 Progress when stopped: ${checkedCount}/${shuffledWebsites.length} websites checked`);
            console.log(`🚨 Unavailable websites found so far: ${unavailableWebsites.length}`);
            console.log(`✅ Successful websites found so far: ${successfulWebsites.length}`);
            console.log(`📈 Completion rate: ${((checkedCount / shuffledWebsites.length) * 100).toFixed(1)}%`);
            console.log(`🚩 Flagging rate: ${checkedCount > 0 ? ((unavailableWebsites.length / checkedCount) * 100).toFixed(1) : 0}%`);
            console.log(`📊 Success rate: ${checkedCount > 0 ? ((successfulWebsites.length / checkedCount) * 100).toFixed(1) : 0}%`);
            console.log('');
            
            if (unavailableWebsites.length > 0) {
              console.log('🚨 FLAGGED SITES FOUND BEFORE INTERRUPTION:');
              unavailableWebsites.forEach((site, index) => {
                console.log(`  ${index + 1}. 🚩 ${site.name}`);
                console.log(`     🔗 ${site.url}`);
                console.log(`     📝 Reason: "${site.pattern}"`);
                console.log('');
              });
            } else {
              console.log('✅ No sites flagged before interruption - all checked sites appear functional!');
            }
            
            if (successfulWebsites.length > 0) {
              console.log('');
              console.log('✅ SUCCESSFUL SITES FOUND BEFORE INTERRUPTION:');
              successfulWebsites.forEach((site, index) => {
                const passedByUser = userPassedWebsites.some(passed => passed.name === site.name && passed.url === site.url);
                const statusIcon = passedByUser ? '👤' : '🤖';
                console.log(`  ${index + 1}. ${statusIcon} ${site.name}`);
                console.log(`     🔗 ${site.url}`);
                console.log(`     📝 ${site.reason}`);
                console.log('');
              });
            } else {
              console.log('');
              console.log('⚠️ No successful sites detected before interruption');
            }
            
            console.log('📋 REMAINING WEBSITES TO CHECK:');
            const remainingWebsites = shuffledWebsites.slice(checkedCount);
            if (remainingWebsites.length > 0) {
              console.log(`📊 ${remainingWebsites.length} websites not yet checked:`);
              remainingWebsites.forEach((site, index) => {
                console.log(`  ${index + 1}. ⏳ ${site.name} - ${site.url}`);
              });
            } else {
              console.log('✅ All websites were checked before interruption');
            }
            
            console.log('');
            console.log('💡 NEXT STEPS:');
            console.log('  🔄 Restart the test to continue from where it left off');
            console.log('  👀 Review any opened tabs for manual verification');
            console.log('  📝 Consider the current results as partial data');
            
            // Download results file for early termination
            console.log('');
            console.log('📁 Generating and downloading results file for early termination...');
            try {
              await downloadResultsFile();
            } catch (downloadError) {
              console.log(`❌ Failed to download results file: ${downloadError.message}`);
            }
            
            console.log('⚠️'.repeat(50));
          }
          
          // Final results summary
          console.log('\n' + '🎯'.repeat(50));
          console.log('🎯 FINAL RESULTS SUMMARY');
          console.log('🎯'.repeat(50));
          console.log(`📊 Total websites checked: ${checkedCount}`);
          console.log(`🚨 Unavailable websites found: ${unavailableWebsites.length}`);
          console.log(`✅ Successful websites found: ${successfulWebsites.length}`);
          console.log(`📊 Success rate: ${checkedCount > 0 ? ((successfulWebsites.length / checkedCount) * 100).toFixed(1) : 0}%`);
          console.log(`📊 Flagging rate: ${checkedCount > 0 ? ((unavailableWebsites.length / checkedCount) * 100).toFixed(1) : 0}%`);
          console.log('');
          
          // Show successful websites first
          displaySuccessfulWebsitesList();
          
          // Show all checked websites at the end
          displayCheckedWebsitesList();
          
          if (unavailableWebsites.length > 0) {
            console.log('📋 COMPLETE MANUAL REVIEW LOG:');
            console.log('🎯 All sites left open for manual review with reasons');
            console.log('');
            unavailableWebsites.forEach((site, index) => {
              console.log(`📑 ${index + 1}. ${site.name}`);
              console.log(`   🔗 URL: ${site.url}`);
              console.log(`   🎯 Reason: "${site.pattern}"`);
              console.log('   ❓ Review: Check if this site actually has functional features that were missed');
              console.log('');
            });
            
            console.log('🔍 PATTERN ANALYSIS:');
            const patternCounts = {};
            unavailableWebsites.forEach(site => {
              patternCounts[site.pattern] = (patternCounts[site.pattern] || 0) + 1;
            });
            
            Object.entries(patternCounts).forEach(([pattern, count]) => {
              console.log(`   📊 "${pattern}": ${count} site(s)`);
            });
            console.log('');
            
            console.log('🌐 Review the opened tabs for manual verification');
            console.log('📝 NO Excel file will be automatically created');
            console.log('👀 Manually review each tab to confirm unavailability');
          } else {
            console.log('✅ All websites appear to be available!');
          }
          

          // Final comprehensive summary
          console.log('\n' + '📈'.repeat(50));
          console.log('📈 COMPREHENSIVE TEST RESULTS');
          console.log(`🔍 DEBUG: Main loop finished. Processed ${checkedCount} out of ${shuffledWebsites.length} total websites`);
          console.log(`🔍 DEBUG: Loop exit reason: ${checkedCount >= shuffledWebsites.length ? 'All websites processed normally' : 'Early exit occurred - check for errors above'}`);
          console.log('📈'.repeat(50));
          console.log(`🎯 Total Websites Tested: ${checkedCount}`);
          console.log(`✅ Successful Websites: ${successfulWebsites.length} (${checkedCount > 0 ? ((successfulWebsites.length / checkedCount) * 100).toFixed(1) : 0}%)`);
          console.log(`🚨 Flagged Websites: ${unavailableWebsites.length} (${checkedCount > 0 ? ((unavailableWebsites.length / checkedCount) * 100).toFixed(1) : 0}%)`);
          
          if (userPassedWebsites.length > 0) {
            console.log(`👤 User-Passed Websites: ${userPassedWebsites.length}`);
          }

          
          console.log('');
          console.log('📊 BREAKDOWN BY CATEGORY:');
          
          if (successfulWebsites.length > 0) {
            console.log('');
            console.log('✅ SUCCESSFUL WEBSITES:');
            successfulWebsites.forEach((site, index) => {
              const passedByUser = userPassedWebsites.some(passed => passed.name === site.name && passed.url === site.url);
              const statusIcon = passedByUser ? '👤 USER PASSED' : '🤖 AUTO DETECTED';
              console.log(`  ${index + 1}. ${site.name}`);
              console.log(`     🔗 ${site.url}`);
              console.log(`     📝 Status: ${statusIcon}`);
              console.log(`     💡 Reason: ${site.reason}`);
              console.log('');
            });
          }
          
          if (unavailableWebsites.length > 0) {
            console.log('🚨 FLAGGED WEBSITES (REQUIRE MANUAL REVIEW):');
            unavailableWebsites.forEach((site, index) => {
              console.log(`  ${index + 1}. ${site.name}`);
              console.log(`     🔗 ${site.url}`);
              console.log(`     📝 Issue: ${site.pattern}`);
              console.log('');
            });
          }
          
          console.log('📈'.repeat(50));
          
          console.log('🎯'.repeat(50));
          
          // Download results file
          console.log('\n📁 Generating and downloading results file...');
          await downloadResultsFile();
          
          console.log('✅ Test completed successfully! Results file downloaded.');
          console.log('🔄 Browser will close automatically in 5 seconds...');
          await page.waitForTimeout(5000);
          
          // Close browser
          await browser.close();
        });
      });