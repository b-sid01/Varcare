const express = require('express');
const app = express();
app.use(express.urlencoded({ extended: false }));

// This runs every time a patient sends a WhatsApp message
app.post('/whatsapp', (req, res) => {
  const patientMessage = req.body.Body.toLowerCase().trim();
  const patientNumber = req.body.From;

  let reply = '';

  if (patientMessage === 'hi' || patientMessage === 'hello') {
    reply = `Welcome to Dr. Sharma's clinic! 👋\n\nWhat would you like to do?\n\nReply *1* — Book appointment\nReply *2* — Check my appointment\nReply *3* — Cancel appointment`;
  }
  else if (patientMessage === '1') {
    reply = `Sure! Let's book your appointment.\n\nWhat is your name?`;
  }
  else if (patientMessage === '2') {
    reply = `Let me check your appointment. Please share your registered mobile number.`;
  }
  else if (patientMessage === '3') {
    reply = `To cancel, please share your appointment date and we'll handle it right away.`;
  }
  else {
    reply = `Sorry, I didn't understand that. Please reply *Hi* to start again.`;
  }

  // Send reply back to patient on WhatsApp
  res.set('Content-Type', 'text/xml');
  res.send(`
    <Response>
      <Message>${reply}</Message>
    </Response>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Bot is running on port ${PORT}`);
});