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
// Google Calendar Setup 📅
const { google } = require('googleapis');
const calendar = google.calendar('v3');

// Calendar authentication setup
const calendarAuth = new google.auth.GoogleAuth({
  credentials: {
    type: 'service_account',
    project_id: process.env.GOOGLE_CALENDAR_PROJECT_ID,
    private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    client_id: process.env.GOOGLE_CLIENT_ID,
  },
  scopes: ['https://www.googleapis.com/auth/calendar']
});
// Calendar Event Creation Function
// async function createCalendarEvent(eventDetails) {
// try {
// const event = {
// summary: eventDetails.event,
// description: eventDetails.description || '',
// start: {
       // dateTime: eventDetails.startTime,
        // timeZone: 'Europe/London',
      // },
      //end: {
      //  dateTime: eventDetails.endTime,
     // timeZone: 'Europe/London',
     // },
    // };

    //const result = await calendar.events.insert({
      //auth: calendarAuth,
      //calendarId: 'primary',
     // resource: event,
    // });

   // return result.data;
  // } catch (error) {
    // console.error('Calendar creation error:', error);
    // throw error;
  // }
// }
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
  console.log("🔍 Raw aiResponse type:", typeof aiResponse);
  console.log("🔍 Raw aiResponse:", aiResponse);
// Parse aiResponse if it's a string
let parsedResponse = aiResponse;
if (typeof aiResponse === 'string') {
    try {
        parsedResponse = JSON.parse(aiResponse);
        console.log("✅ Successfully parsed aiResponse");
    } catch (error) {
        console.log("❌ Failed to parse aiResponse:", error);
        parsedResponse = aiResponse;
    }
}
  console.log("🔍 About to check for calendar match...");
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

  // Handle reminder commands
    if (parsedResponse.actions && (parsedResponse.actions[0].action === 'CreateReminder' || parsedResponse.actions[0].action === 'remind')) {
        const reminderDetails = parsedResponse.actions[0].parameters || { about: parsedResponse.actions[0].content, time: parsedResponse.trigger };
        return res.json({
            success: true,
            message: `✅ Reminder set for ${reminderDetails.about} at ${reminderDetails.time}! You'll get a browser notification 5 minutes before.`,
            action: 'reminder',
            details: reminderDetails
        });
    }
  // Parse Calendar command 📅
    // console.log("🔍 Checking trigger:", parsedResponse?.trigger);
    // console.log("🔍 Checking actions:", parsedResponse?.actions);
// if (parsedResponse?.actions && parsedResponse.actions.length > 0) {
  //  console.log("🔍 Checking first action:", parsedResponse.actions[0].action);
// } else {
    // console.log("❌ No actions found or actions is undefined");
// }
    // const calendarMatch = (parsedResponse.actions && parsedResponse.actions.length > 0) && 
   // (parsedResponse.trigger.toLowerCase().includes('meeting') || 
    // parsedResponse.trigger.toLowerCase().includes('appointment') || 
   //  parsedResponse.trigger.toLowerCase().includes('schedule') ||
   //  parsedResponse.actions[0].action.toLowerCase().includes('event') ||
  //   parsedResponse.actions[0].action.toLowerCase().includes('create') ||
 //    parsedResponse.actions[0].action.toLowerCase().includes('meeting') ||
   // (parsedResponse.actions[0].parameters && (parsedResponse.actions[0].parameters.date ||parsedResponse.actions[0].parameters.time)) ||
   // (parsedResponse.actions[0].details && (parsedResponse.actions[0].details.date ||parsedResponse.actions[0].details.time)));
    
    //if (calendarMatch) {
      // console.log("✅ Calendar match found!");
      // console.log("📅 Creating calendar event...");
      // const eventTitle = parsedResponse.trigger || 'New Event';
        
        // try {
            // const eventDetails = {
                // title: eventTitle,
                // description: `Created by NLAA: ${command}`,
                // startTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                // endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
            // };
            
            // await createCalendarEvent(eventDetails);
           //  return res.json({ success: true, message: `📅 Calendar event "${eventTitle}" created successfully!` });
        // } catch (error) {
            // console.error('Calendar error:', error);
            // return res.json({ success: false, message: 'Failed to create calendar event' });
        // }
    // }
  if (whatsappMatch) {
    const [, name, phone, message] = whatsappMatch;
    
    try {
      const success = await addContactToSheet(name.trim(), phone.trim(), message.trim());
      
      if (success) {
        res.json({
          success: true,
          message: `✅ Contact added successfully!\n\nName: ${name.trim()}\nPhone: ${phone.trim()}\nMessage: ${message.trim()}\n\nCheck your Google Sheet!`
        });
      } else { console.log("❌ No calendar match found");
    console.log("🔍 Checking trigger:", aiResponse.trigger);
    console.log("🔍 Checking actions:", aiResponse.actions);
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
