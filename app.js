const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const path = require('path');
const OpenAI = require('openai');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static('public'));

// Google Sheets setup
const setupGoogleSheets = async () => {
  try {
    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    return doc;
  } catch (error) {
    console.error('Google Sheets setup error:', error);
    throw error;
  }
};

// Add contact to Google Sheets
const addContactToSheet = async (name, phone, message) => {
  try {
    const doc = await setupGoogleSheets();
    const sheet = doc.sheetsByIndex[0];
    
    await sheet.addRow({
      'Name': name,
      'Phone': phone,
      'Message': message,
      'Date Added': new Date().toLocaleDateString()
    });
    
    return true;
  } catch (error) {
    console.error('Error adding to sheet:', error);
    return false;
  }
};

// Process automation command
app.post('/api/automation', async (req, res) => {
  const { command } = req.body;
  
  console.log('Processing command:', command);
  
  // Parse WhatsApp contact command
  const whatsappMatch = command.match(/Add WhatsApp contact:\s*([^,]+),\s*([^,]+),\s*"([^"]+)"/);
  
  if (whatsappMatch) {
    const [, name, phone, message] = whatsappMatch;
    
    try {
      const success = await addContactToSheet(name.trim(), phone.trim(), message.trim());
      
      if (success) {
        res.json({
          success: true,
          message: `✅ Contact added successfully!\n\nName: ${name.trim()}\nPhone: ${phone.trim()}\nMessage: ${message.trim()}\n\nCheck your Google Sheet!`
        });
      } else {
        res.json({
          success: false,
          message: '❌ Failed to add contact to Google Sheet. Check your environment variables.'
        });
      }
    } catch (error) {
      console.error('Automation error:', error);
      res.json({
        success: false,
        message: '❌ Error processing automation: ' + error.message
      });
    }
  } else {
    res.json({
      success: false,
      message: '❌ Command not recognized. Use format: Add WhatsApp contact: Name, Phone, "Message"'
    });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`SimpleFlow Enhanced running on port ${PORT}`);
  console.log('Environment check:');
  console.log('- GOOGLE_PROJECT_ID:', process.env.GOOGLE_PROJECT_ID ? '✅' : '❌');
  console.log('- GOOGLE_CLIENT_EMAIL:', process.env.GOOGLE_CLIENT_EMAIL ? '✅' : '❌');
  console.log('- GOOGLE_PRIVATE_KEY:', process.env.GOOGLE_PRIVATE_KEY ? '✅' : '❌');
  console.log('- GOOGLE_SHEET_ID:', process.env.GOOGLE_SHEET_ID ? '✅' : '❌');
});
// OpenAI function to process text
async function processWithAI(text, task = "summarize") {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {"role": "system", "content": `You are a helpful assistant that can ${task} text.`},
        {"role": "user", "content": text}
      ]
    });
    return response.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI Error:', error);
    return 'Error processing with AI';
  }
}
