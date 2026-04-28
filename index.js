const express = require('express');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
app.use(express.urlencoded({ extended: false }));

// Connect to Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Store conversation state per patient
const sessions = {};

app.post('/whatsapp', async (req, res) => {
  const msg = req.body.Body.trim();
  const phone = req.body.From;

  if (!sessions[phone]) sessions[phone] = { step: 'start' };
  const session = sessions[phone];

  let reply = '';

  if (session.step === 'start') {
    reply = `Welcome to Dr. Sharma's clinic! 👋\n\nWhat would you like to do?\n\nReply *1* — Book appointment\nReply *2* — Check my appointment\nReply *3* — Cancel appointment`;
    session.step = 'menu';
  }
  else if (session.step === 'menu' && msg === '1') {
    reply = `Sure! What is your name?`;
    session.step = 'get_name';
  }
  else if (session.step === 'get_name') {
    session.name = msg;
    reply = `Thanks ${msg}! What date and time would you like? (Example: Tomorrow 3pm)`;
    session.step = 'get_time';
  }
  else if (session.step === 'get_time') {
    session.time = msg;

    // Save to Supabase
    const { error } = await supabase
      .from('appointments')
      .insert([{
        name: session.name,
        phone: phone,
        time: session.time
      }]);

    if (error) {
      reply = `Something went wrong. Please try again.`;
    } else {
      reply = `Appointment requested! ✅\n\nName: ${session.name}\nTime: ${session.time}\n\nDr. Sharma will confirm shortly.`;
    }
    sessions[phone] = { step: 'start' };
  }
  else {
    sessions[phone] = { step: 'start' };
    reply = `Please reply *Hi* to start again.`;
  }

  res.set('Content-Type', 'text/xml');
  res.send(`<Response><Message>${reply}</Message></Response>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Varcare bot running on port ${PORT}`));