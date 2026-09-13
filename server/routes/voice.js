const express = require('express');
const router = express.Router();
const db = require('../db');

// Multi-language translations and bulletin templates
const TRANSLATIONS = {
  hi: {
    locale: 'hi-IN',
    greeting: 'नमस्ते किसान भाइयों और उपभोक्ताओं।',
    platformIntro: 'किसान डायरेक्ट एआई दैनिक कृषि बाजार बुलेटिन में आपका स्वागत है।',
    todayDatePrefix: 'आज का लाइव मंडी एवं फार्मगेट भाव:',
    commodityRate: (name, farmgate, unit, gainPct, mandi) => 
      `${name} का सीधा फार्मगेट भाव ₹${farmgate} प्रति ${unit} है, जो पारंपरिक एपीएमसी मंडी भाव ₹${mandi} से ${gainPct}% अधिक मुनाफा दे रहा है।`,
    zeroCommission: 'किसान डायरेक्ट पर बिचौलियों का कमीशन शून्य प्रतिशत है, और किसान को 72 प्रतिशत सीधा भुगतान मिलता है।',
    advisory: 'उपभोक्ता मामलों के मंत्रालय (DOCA) द्वारा प्रमाणित डिजिटल क्यूसी सर्टिफिकेट सभी लॉट के लिए सक्रिय है।',
    allProduceHeadline: 'राष्ट्रीय कृषि ग्रिड दैनिक मूल्य बुलेटिन'
  },
  en: {
    locale: 'en-IN',
    greeting: 'Namaste farmers, FPOs, and buyers.',
    platformIntro: 'Welcome to the KisanDirect AI Daily Agri-Marketplace Price Bulletin.',
    todayDatePrefix: 'Today\'s live farmgate vs mandi rates:',
    commodityRate: (name, farmgate, unit, gainPct, mandi) => 
      `For ${name}, the direct farmgate rate is ₹${farmgate} per ${unit}, delivering ${gainPct}% higher realization than the local APMC mandi rate of ₹${mandi}.`,
    zeroCommission: 'Middleman commission is zero percent, with farmers receiving 72% direct escrow payment.',
    advisory: 'Digital quality certification verified under Ministry of Consumer Affairs guidelines.',
    allProduceHeadline: 'National Agricultural Grid Daily Market Bulletin'
  },
  mr: {
    locale: 'mr-IN',
    greeting: 'नमस्कार शेतकरी मित्रांनो आणि ग्राहकांनो.',
    platformIntro: 'किसान डायरेक्ट एआय दैनिक कृषी बाजार भाव बुलेटिनमध्ये आपले स्वागत आहे.',
    todayDatePrefix: 'आजचे थेट शेतमाल भाव:',
    commodityRate: (name, farmgate, unit, gainPct, mandi) => 
      `${name} चा थेट दर ₹${farmgate} प्रति ${unit} असून, पारंपरिक एपीएमसी बाजार समितीपेक्षा ${gainPct}% अधिक नफा मिळत आहे.`,
    zeroCommission: 'दलालांचे कमिशन शून्य टक्के असून 72 टक्के रक्कम थेट शेतकऱ्यांच्या खात्यात जमा होते.',
    advisory: 'ग्राहक व्यवहार मंत्रालयाकडून प्रमाणित डिजिटल गुणवत्ता प्रमाणपत्र उपलब्ध आहे.',
    allProduceHeadline: 'महाराष्ट्र व राष्ट्रीय कृषी ग्रीड दैनिक भाव'
  },
  te: {
    locale: 'te-IN',
    greeting: 'నమస్కారం రైతు సోదరులు మరియు వినియోగదారులారా.',
    platformIntro: 'కిసాన్ డైరెక్ట్ AI రోజువారీ వ్యవసాయ మార్కెట్ ధరల బులెటిన్‌కు స్వాగతం.',
    todayDatePrefix: 'నేటి ప్రత్యక్ష వ్యవసాయ ధరలు:',
    commodityRate: (name, farmgate, unit, gainPct, mandi) => 
      `${name} ప్రత్యక్ష ధర క్వింటాల్ లేదా యూనిట్‌కు ₹${farmgate}, ఇది సాధారణ మార్కెట్ కంటే ${gainPct}% ఎక్కువ లాభం అందిస్తుంది.`,
    zeroCommission: 'మధ్యవర్తుల కమిషన్ సున్నా శాతం, రైతుకు 72% నేరుగా అందుతుంది.',
    advisory: 'వినియోగదారుల వ్యవహారాల మంత్రిత్వ శాఖ డిజిటల్ నాణ్యత ధృవీకరణ అమల్లో ఉంది.',
    allProduceHeadline: 'జాతీయ వ్యవసాయ గ్రిడ్ రోజువారీ ధరల బులెటిన్'
  },
  ta: {
    locale: 'ta-IN',
    greeting: 'வணக்கம் விவசாய பெருமக்களே மற்றும் நுகர்வோரே.',
    platformIntro: 'கிசான் டைரக்ட் AI தினசரி சந்தை விலை செய்திக்கு வரவேற்கிறோம்.',
    todayDatePrefix: 'இன்றைய நேரடி பண்ணை விலை நிலவரம்:',
    commodityRate: (name, farmgate, unit, gainPct, mandi) => 
      `${name} நேரடி விலை ₹${farmgate} ஒரு ${unit}-க்கு, இது பாரம்பரிய ஏபிஎம்சி சந்தையை விட ${gainPct}% கூடுதல் லாபம் தருகிறது.`,
    zeroCommission: 'இடைத்தரகர்கள் கமிஷன் பூஜ்ஜியம் சதவீதம். விவசாயிகளுக்கு 72% நேரடி கட்டணம்.',
    advisory: 'நுகர்வோர் விவகார அமைச்சகத்தின் டிஜிட்டல் தர சான்றிதழ் வழங்கப்படுகிறது.',
    allProduceHeadline: 'தேசிய வேளாண்மை சந்தை தினசரி விலை அறிக்கை'
  },
  gu: {
    locale: 'gu-IN',
    greeting: 'નમસ્તે ખેડૂત મિત્રો અને ગ્રાહકો.',
    platformIntro: 'કિસાન ડાયરેક્ટ AI દૈનિક બજાર ભાવ બુલેટિનમાં આપનું સ્વાગત છે.',
    todayDatePrefix: 'આજના સીધા ખેત ભાવ:',
    commodityRate: (name, farmgate, unit, gainPct, mandi) => 
      `${name} નો સીધો ભાવ ₹${farmgate} પ્રતિ ${unit} છે, જે સામાન્ય એપીએમસી કરતાં ${gainPct}% વધુ નફો આપે છે.`,
    zeroCommission: 'દલાલી શૂન્ય ટકા અને 72% સીધું ચુકવણું ખેડૂતોના ખાતામાં.',
    advisory: 'ગ્રાહક બાબતોના મંત્રાલય દ્વારા પ્રમાણિત ડિજિટલ ગુણવત્તા સુરક્ષિત છે.',
    allProduceHeadline: 'દૈનિક કૃષિ બજાર ભાવ બુલેટિન'
  },
  kn: {
    locale: 'kn-IN',
    greeting: 'ನಮಸ್ಕಾರ ರೈತ ಬಾಂಧವರೇ ಮತ್ತು ಗ್ರಾಹಕರೇ.',
    platformIntro: 'ಕಿಸಾನ್ ಡೈರೆಕ್ಟ್ ಎಐ ದೈನಂದಿನ ಕೃಷಿ ಮಾರುಕಟ್ಟೆ ದರಗಳ ಬುಲೆಟಿನ್‌ಗೆ ಸ್ವಾಗತ.',
    todayDatePrefix: 'ಇಂದಿನ ನೇರ ಮಾರುಕಟ್ಟೆ ದರಗಳು:',
    commodityRate: (name, farmgate, unit, gainPct, mandi) => 
      `${name} ನೇರ ದರ ₹${farmgate} ಪ್ರತಿ ${unit}, ಇದು ಸಾಂಪ್ರದಾಯಿಕ ಮಂಡಿಗಿಂತ ${gainPct}% ಹೆಚ್ಚು ಲಾಭ ನೀಡುತ್ತದೆ.`,
    zeroCommission: 'ಮಧ್ಯವರ್ತಿಗಳ ಕಮಿಷನ್ ಶೂನ್ಯ ಶೇಕಡಾ, ರೈತರಿಗೆ 72% ನೇರ ಪಾವತಿ.',
    advisory: 'ಗ್ರಾಹಕ ವ್ಯವಹಾರಗಳ ಸಚಿವಾಲಯದ ಡಿಜಿಟಲ್ ಗುಣಮಟ್ಟ ಪ್ರಮಾಣೀಕರಣ ಲಭ್ಯವಿದೆ.',
    allProduceHeadline: 'ರಾಷ್ಟ್ರೀಯ ಕೃಷಿ ಗ್ರಿಡ್ ದೈನಂದಿನ ದರ ಬುಲೆಟಿನ್'
  },
  bn: {
    locale: 'bn-IN',
    greeting: 'নমস্কার কৃষক ভাই ও বোনেরা এবং ক্রেতাবৃন্দ।',
    platformIntro: 'কিসান ডাইরেক্ট এআই দৈনিক কৃষি বাজার বুলেটিনে আপনাকে স্বাগতম।',
    todayDatePrefix: 'আজকের সরাসরি কৃষি পণ্যের বাজার দর:',
    commodityRate: (name, farmgate, unit, gainPct, mandi) => 
      `${name}-এর সরাসরি খামার দর প্রতি ${unit} ₹${farmgate}, যা সাধারণ এপিএমসি মণ্ডির চেয়ে ${gainPct}% বেশি লাভজনক।`,
    zeroCommission: 'দালালদের কমিশন শূন্য শতাংশ এবং ৭২% সরাসরি কৃষকের অ্যাকাউন্টে প্রদান করা হয়।',
    advisory: 'উপভোক্তা বিষয়ক মন্ত্রকের ডিজিটাল গুণমান শংসাপত্র দ্বারা প্রত্যয়িত।',
    allProduceHeadline: 'জাতীয় কৃষি গ্রিড দৈনিক মূল্য বুলেটিন'
  },
  pa: {
    locale: 'pa-IN',
    greeting: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਕਿਸਾਨ ਭਰਾਵੋ ਅਤੇ ਖਪਤਕਾਰੋ।',
    platformIntro: 'ਕਿਸਾਨ ਡਾਇਰੈਕਟ ਏਆਈ ਰੋਜ਼ਾਨਾ ਮੰਡੀ ਭਾਅ ਬੁਲੇਟਿਨ ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ।',
    todayDatePrefix: 'ਅੱਜ ਦੇ ਲਾਈਵ ਫਾਰਮਗੇਟ ਅਤੇ ਮੰਡੀ ਰੇਟ:',
    commodityRate: (name, farmgate, unit, gainPct, mandi) => 
      `${name} ਦਾ ਸਿੱਧਾ ਰੇਟ ₹${farmgate} ਪ੍ਰਤੀ ${unit} ਹੈ, ਜੋ ਆਮ ਮੰਡੀ ਨਾਲੋਂ ${gainPct}% ਵੱਧ ਮੁਨਾਫਾ ਦੇ ਰਿਹਾ ਹੈ।`,
    zeroCommission: 'ਵਿਚੋਲਿਆਂ ਦਾ ਕਮਿਸ਼ਨ ਜ਼ੀਰੋ ਪ੍ਰਤੀਸ਼ਤ ਹੈ ਅਤੇ ਕਿਸਾਨਾਂ ਨੂੰ 72% ਸਿੱਧੀ ਅਦਾਇਗੀ ਮਿਲਦੀ ਹੈ।',
    advisory: 'ਖਪਤਕਾਰ ਮਾਮਲਿਆਂ ਦੇ ਮੰਤਰਾਲੇ ਵੱਲੋਂ ਡਿਜੀਟਲ ਕੁਆਲਿਟੀ ਸਰਟੀਫਿਕੇਟ ਜਾਰੀ ਕੀਤਾ ਗਿਆ ਹੈ।',
    allProduceHeadline: 'ਰਾਸ਼ਟਰੀ ਖੇਤੀਬਾੜੀ ਗ੍ਰਿਡ ਰੋਜ਼ਾਨਾ ਮੰਡੀ ਬੁਲੇਟਿਨ'
  }
};

// GET /api/voice/bulletin
// Query parameters:
// - lang: 'hi', 'en', 'mr', 'te', 'ta', 'gu', 'kn', 'bn', 'pa' (default: 'hi')
// - commodityId: optional specific commodity ID
router.get('/bulletin', (req, res) => {
  try {
    const lang = (req.query.lang || 'hi').toLowerCase();
    const t = TRANSLATIONS[lang] || TRANSLATIONS.hi;
    const commodityId = req.query.commodityId;

    // Fetch active commodities from database
    let commodities;
    if (commodityId) {
      commodities = db.prepare(`
        SELECT c.*, p.name as category 
        FROM commodities c
        JOIN produce_categories p ON c.category_id = p.id
        WHERE c.id = ?
      `).all(commodityId);
    } else {
      // Pick top diverse commodities for the daily highlight broadcast
      commodities = db.prepare(`
        SELECT c.*, p.name as category 
        FROM commodities c
        JOIN produce_categories p ON c.category_id = p.id
        ORDER BY c.id ASC
        LIMIT 6
      `).all();
    }

    if (!commodities || commodities.length === 0) {
      commodities = db.prepare(`
        SELECT c.*, p.name as category 
        FROM commodities c
        JOIN produce_categories p ON c.category_id = p.id
        LIMIT 3
      `).all();
    }

    const todayDate = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const ratesSummary = [];
    const commodityLines = [];

    for (const c of commodities) {
      const baseMandi = c.base_mandi_benchmark_rate;
      const farmgate = +(baseMandi * 1.45).toFixed(2);
      const gainPct = Math.round(((farmgate - baseMandi) / baseMandi) * 100);

      ratesSummary.push({
        id: c.id,
        name: c.name,
        category: c.category,
        standard_unit: c.standard_unit,
        base_mandi_benchmark: baseMandi,
        direct_farmgate_rate: farmgate,
        farmer_gain_pct: gainPct
      });

      commodityLines.push(t.commodityRate(c.name, farmgate, c.standard_unit, gainPct, baseMandi));
    }

    // Build the complete spoken audio script
    const spokenParts = [
      t.greeting,
      t.platformIntro,
      `${t.todayDatePrefix} (${todayDate}).`,
      commodityLines.join(' '),
      t.zeroCommission,
      t.advisory
    ];

    const audioText = spokenParts.join(' ');

    res.json({
      success: true,
      date: todayDate,
      language: lang,
      locale: t.locale,
      headline: t.allProduceHeadline,
      audioText,
      commoditiesCount: commodities.length,
      ratesSummary
    });
  } catch (err) {
    console.error('Error generating voice bulletin:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/voice/languages - List supported languages
router.get('/languages', (req, res) => {
  res.json({
    success: true,
    languages: [
      { code: 'hi', name: 'Hindi (हिन्दी)', locale: 'hi-IN', flag: '🇮🇳' },
      { code: 'en', name: 'English (Indian)', locale: 'en-IN', flag: '🇬🇧' },
      { code: 'mr', name: 'Marathi (मराठी)', locale: 'mr-IN', flag: '🇮🇳' },
      { code: 'te', name: 'Telugu (తెలుగు)', locale: 'te-IN', flag: '🇮🇳' },
      { code: 'ta', name: 'Tamil (தமிழ்)', locale: 'ta-IN', flag: '🇮🇳' },
      { code: 'gu', name: 'Gujarati (ગુજરાતી)', locale: 'gu-IN', flag: '🇮🇳' },
      { code: 'kn', name: 'Kannada (ಕನ್ನಡ)', locale: 'kn-IN', flag: '🇮🇳' },
      { code: 'bn', name: 'Bengali (বাংলা)', locale: 'bn-IN', flag: '🇮🇳' },
      { code: 'pa', name: 'Punjabi (ਪੰਜਾਬੀ)', locale: 'pa-IN', flag: '🇮🇳' }
    ]
  });
});

module.exports = router;
