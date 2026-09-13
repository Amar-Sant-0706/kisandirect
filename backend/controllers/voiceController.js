const db = require('../db');

// Voice scripts dictionary for regional languages
const voiceBriefings = {
  'mr-IN': {
    lang: 'mr-IN',
    languageName: 'मराठी',
    title: 'किसान वाणी दैनिक कृषी बुलेटिन',
    script: 'नमस्कार रामेश्वरजी. किसान वाणी मध्ये आपले स्वागत आहे. आज लासलगाव बाजार समितीत कांद्याचा सरासरी भाव सोळा रुपये आहे, पण किसान डायरेक्ट ग्रिडवर तुम्हाला चोवीस रुपये पन्नास पैसे थेट मिळत आहेत. सोलापूर टोमॅटोचा भाव बावीस रुपये प्रति किलो आहे. तुमची तीन क्विंटल मालाची ऑर्डर मंजूर झाली असून, उद्या सकाळी साडे आठ वाजता शीतगृह व्हॅन पिकअपसाठी येत आहे. धन्यवाद आणि शुभ दिवस!',
    summary: {
      onionPrice: '₹ 24.50/kg (किसान डायरेक्ट) वि. ₹ 16.00/kg (मंडी)',
      tomatoPrice: '₹ 22.00/kg (किसान डायरेक्ट) वि. ₹ 13.50/kg (मंडी)',
      nextPickup: 'उद्या सकाळी ०८:३० वाजता (वाशी हब)'
    }
  },
  'hi-IN': {
    lang: 'hi-IN',
    languageName: 'हिन्दी',
    title: 'किसान वाणी दैनिक कृषि बुलेटिन',
    script: 'नमस्ते रामेश जी. किसान वाणी दैनिक बुलेटिन में आपका स्वागत है। आज लासलगांव मंडी में प्याज का भाव 16 रुपये प्रति किलो है, जबकि किसान डायरेक्ट नेशनल ग्रिड पर आपको 24 रुपये 50 पैसे का सीधा भाव मिल रहा है। सोलापुर टमाटर का भाव 22 रुपये प्रति किलो चल रहा है। आपकी कोल्ड-चेन पिकअप कल सुबह 8:30 बजे निर्धारित है। धन्यवाद!',
    summary: {
      onionPrice: '₹ 24.50/kg (किसान डायरेक्ट) vs ₹ 16.00/kg (मंडी)',
      tomatoPrice: '₹ 22.00/kg (किसान डायरेक्ट) vs ₹ 13.50/kg (मंडी)',
      nextPickup: 'कल सुबह 08:30 बजे (वाशी कोल्ड-चेन)'
    }
  },
  'en-IN': {
    lang: 'en-IN',
    languageName: 'English (India)',
    title: 'Kisan Vani Daily Agri Briefing',
    script: 'Welcome to Kisan Vani Daily Agricultural Briefing, Ramesh ji. Today\'s Lasalgaon APMC Mandi benchmark price for Red Onion is 16 Rupees, while your direct farmgate realization on KisanDirect Grid is 24 Rupees and 50 paise per kg, delivering a 53% margin premium. Solapur Vine Tomatoes are trading at 22 Rupees per kg. Your scheduled cold-chain reefer truck is confirmed for pickup tomorrow at 8:30 AM. Happy farming!',
    summary: {
      onionPrice: '₹ 24.50/kg (KisanDirect) vs ₹ 16.00/kg (Mandi)',
      tomatoPrice: '₹ 22.00/kg (KisanDirect) vs ₹ 13.50/kg (Mandi)',
      nextPickup: 'Tomorrow 08:30 AM (Vashi Hub Corridor)'
    }
  }
};

exports.getVoiceBriefing = (req, res) => {
  try {
    const lang = req.query.lang || 'mr-IN';
    const briefing = voiceBriefings[lang] || voiceBriefings['mr-IN'];

    return res.json({
      success: true,
      briefing: {
        ...briefing,
        timestamp: new Date().toISOString(),
        commodities: [
          { crop: 'Nashik Red Onion', kisanPrice: 24.50, mandiPrice: 16.00, gain: '+53%' },
          { crop: 'Solapur Vine Tomato', kisanPrice: 22.00, mandiPrice: 13.50, gain: '+63%' },
          { crop: 'Agra Chipsona Potato', kisanPrice: 18.00, mandiPrice: 12.00, gain: '+50%' }
        ]
      }
    });
  } catch (err) {
    console.error('Error generating voice briefing:', err);
    return res.status(500).json({ error: 'VOICE_BRIEFING_FAILED', message: 'Failed to generate voice briefing' });
  }
};

exports.handleVoiceQuery = (req, res) => {
  try {
    const { query, lang = 'mr-IN' } = req.body;
    const q = (query || '').toLowerCase().trim();

    let reply = '';
    let cropMatch = null;

    if (q.includes('कांदा') || q.includes('onion') || q.includes('प्याज')) {
      cropMatch = 'Onion';
      if (lang === 'mr-IN') {
        reply = 'आज किसान डायरेक्टवर कांद्याचा थेट भाव चोवीस रुपये पन्नास पैसे आहे. नाशिक मंडीपेक्षा तुम्हाला प्रति किलो साडेआठ रुपये जास्त मिळत आहेत.';
      } else if (lang === 'hi-IN') {
        reply = 'आज किसान डायरेक्ट पर प्याज का भाव 24 रुपये 50 पैसे प्रति किलो है, जो मंडी से 8 रुपये 50 पैसे अधिक है।';
      } else {
        reply = 'Today, Red Onion is realizing 24.50 Rupees per kg on KisanDirect, 8.50 Rupees higher than the APMC Mandi cartel.';
      }
    } else if (q.includes('टोमॅटो') || q.includes('tomato') || q.includes('टमाटर')) {
      cropMatch = 'Tomato';
      if (lang === 'mr-IN') {
        reply = 'आज दर्जेदार सोलापूर टोमॅटोचा थेट भाव बावीस रुपये प्रति किलो आहे. ग्रेड ए प्लस मालाला मोठी मागणी आहे.';
      } else if (lang === 'hi-IN') {
        reply = 'आज सोलापुर टमाटर का भाव 22 रुपये प्रति किलो है। ग्रेड ए प्लस माल की भारी मांग है।';
      } else {
        reply = 'Vine-ripe Tomatoes are trading at 22.00 Rupees per kg direct from farmgate.';
      }
    } else if (q.includes('पिकअप') || q.includes('गाडी') || q.includes('pickup') || q.includes('truck') || q.includes('reefer')) {
      if (lang === 'mr-IN') {
        reply = 'तुमच्या शीतगृह ट्रकचा स्लॉट उद्या सकाळी साडे आठ वाजता निश्चित झाला आहे. गाडी क्रमांक एमएच १५ ईजी ८०४२ आहे.';
      } else if (lang === 'hi-IN') {
        reply = 'आपके रीफर ट्रक का स्लॉट कल सुबह 8:30 बजे कन्फर्म है। वाहन क्रमांक एमएच 15 ईजी 8042 है।';
      } else {
        reply = 'Your Reefer truck MH-15-EG-8042 is scheduled for farmgate pickup tomorrow at 8:30 AM.';
      }
    } else {
      // General briefing response
      if (lang === 'mr-IN') {
        reply = 'आज किसान डायरेक्टवर सर्व पिकांचे भाव मंडीपेक्षा तीस ते पन्नास टक्के जास्त आहेत. तुमचे सर्व पेमेंट टी प्लस वन थेट बँक खात्यात जमा होत आहेत.';
      } else if (lang === 'hi-IN') {
        reply = 'आज किसान डायरेक्ट पर सभी फसलों के भाव मंडी से 30 से 50 प्रतिशत अधिक हैं। आपका भुगतान टी प्लस वन एस्क्रो द्वारा सुरक्षित है।';
      } else {
        reply = 'All commodity prices on KisanDirect are 30 to 50 percent higher than APMC cartels, protected by T+1 escrow settlement.';
      }
    }

    return res.json({
      success: true,
      query: q,
      lang,
      reply,
      cropMatch
    });
  } catch (err) {
    console.error('Error handling voice query:', err);
    return res.status(500).json({ error: 'VOICE_QUERY_FAILED', message: 'Failed to process voice query' });
  }
};
