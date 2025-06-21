const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.'));

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API endpoint to process workflow steps
app.post('/api/process-step', async (req, res) => {
    const { stepText, stepNumber } = req.body;
    
    try {
        const result = await processNaturalLanguage(stepText);
        res.json({ 
            success: true, 
            result: result,
            stepNumber: stepNumber 
        });
    } catch (error) {
        res.json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Simple language processor
async function processNaturalLanguage(text) {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('send email')) {
        return `📧 Email action: "${text}"`;
    } else if (lowerText.includes('get data') || lowerText.includes('fetch')) {
        return `📥 Data retrieval: "${text}"`;
    } else if (lowerText.includes('save') || lowerText.includes('store')) {
        return `💾 Save action: "${text}"`;
    } else if (lowerText.includes('wait') || lowerText.includes('delay')) {
        return `⏰ Wait action: "${text}"`;
    } else {
        return `✅ Action recognized: "${text}"`;
    }
}

app.listen(PORT, () => {
    console.log(`SimpleFlow app running on port ${PORT}`);
});
