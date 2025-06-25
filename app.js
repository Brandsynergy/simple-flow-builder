const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const path = require('path');
const OpenAI = require('openai');
const nodemailer = require('nodemailer');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
// Email Setup 📧
const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});
// Smart Command Parser - The Brain! 🧠 (Using GPT-4!)
async function parseCommand(userCommand) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{
        role: "system",
        content: "You are a helpful automation assistant. Parse user commands into simple actions. Return JSON with: trigger, actions array. Keep it simple."
      }, {
        role: "user", 
        content: userCommand
      }],
      max_tokens: 200
    });
    
    return response.choices[0].message.content;
  } catch (error) {
    console.log('AI Error:', error);
    return 'Sorry, I could not understand that command.';
  }
}

// Send Email Function 📧
async function sendEmail(to, subject, message) {
  console.log('🔍 Email Debug - Starting sendEmail function');
  console.log('📧 To:', to);
  console.log('📝 Subject:', subject);
  console.log('💬 Message:', message);
  
  try {
    console.log('📤 Attempting to send email...');
    const info = await emailTransporter.sendMail({
      from: process.env.GMAIL_USER,
      to: to,
      subject: subject,
      text: message
    });
    
    console.log('✅ Email sent successfully!', info.messageId);
    return 'Email sent successfully!';
  } catch (error) {
    console.error('❌ Email error:', error);
    return 'Failed to send email';
  }
}
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
  // Use GPT-4 to understand the command! 🧠
  const aiResponse = await parseCommand(command);
  console.log('AI understood:', aiResponse);
  // Parse WhatsApp contact command
  const whatsappMatch = command.match(/Add WhatsApp contact:\s*([^,]+),\s*([^,]+),\s*"([^"]+)"/);
  // Parse Email command 📧
    const emailMatch = command.match(/(send.*email|compose.*email).*to\s+(\S+).*subject.*?['"]([^'"]+)['"].*message.*?['"]([^'"]+)['"]/i);
    
    if (emailMatch) {
      const [, , to, subject, message] = emailMatch;
      
      try {
        const emailResult = await sendEmail(to.trim(), subject.trim(), message.trim());
        
        if (emailResult === 'Email sent successfully!') {
          res.json({
            success: true,
            message: `✅ Email sent to ${to}!`,
            details: `Subject: ${subject}`
          });
          return;
        }
      } catch (error) {
        console.log('Email execution error:', error);
      }
    }
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
      message: `🎉 SUCCESS! Your NLAA understood the command: ${aiResponse}`
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
      model: "gpt-4",
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
