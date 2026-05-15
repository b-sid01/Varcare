const express = require('express');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const sessions = {};

async function sendWhatsApp(to, message) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const client = require('twilio')(accountSid, authToken);

  await client.messages.create({
    from: 'whatsapp:+14155238886',
    to: to,
    body: message
  });
}

app.post('/whatsapp', async (req, res) => {
  const msg = req.body.Body.trim();
  const phone = req.body.From;

  if (!sessions[phone]) sessions[phone] = { step: 'start' };
  const session = sessions[phone];

  let reply = '';

  if (session.step === 'start') {
    reply = `Welcome to Varcare\n\nThis service helps you book appointments with your doctor securely.\n\nPrivacy Notice: By continuing, you agree that your name, phone number, and appointment details will be stored securely and shared only with your doctor. You can request deletion of your data anytime by replying DELETE.\n\nReply 1 - Book appointment\nReply 2 - Check my appointment\nReply 3 - Cancel appointment\nReply PRIVACY - View privacy policy`;
    session.step = 'menu';
  }

  else if (session.step === 'menu' && msg.toUpperCase() === 'PRIVACY') {
    reply = `Varcare Privacy Policy\n\n- We collect your name, phone number, and appointment details\n- Your data is shared only with your doctor\n- We never sell your data to third parties\n- You can request data deletion anytime by replying DELETE\n- Data is stored securely on encrypted servers\n- Full policy: https://varcare-dashboard.vercel.app/privacy\n\nReply 1 to book an appointment.`;
    session.step = 'menu';
  }

  else if (session.step === 'menu' && msg.toUpperCase() === 'DELETE') {
    await supabase.from('Appointments').delete().eq('phone', phone);
    await supabase.from('patients').delete().eq('phone', phone);
    reply = `Your data has been deleted from our system. Thank you for using Varcare.`;
    sessions[phone] = { step: 'start' };
  }

  else if (session.step === 'menu' && msg === '1') {
    reply = `Sure! What is your full name?`;
    session.step = 'get_name';
  }

  else if (session.step === 'get_name') {
    session.name = msg;
    reply = `Thanks ${msg}! What is your age?`;
    session.step = 'get_age';
  }

  else if (session.step === 'get_age') {
    session.age = msg;
    reply = `What date and time would you like your appointment?\n\nExample: Tomorrow 3pm or 20 May 10am`;
    session.step = 'get_time';
  }

  else if (session.step === 'get_time') {
    session.time = msg;

    const { error } = await supabase
      .from('Appointments')
      .insert([{
        name: session.name,
        phone: phone,
        time: session.time,
        age: session.age,
        consent: true
      }]);

    if (error) {
      reply = `Something went wrong. Please try again by replying Hi.`;
    } else {
      reply = `Appointment requested\n\nName: ${session.name}\nAge: ${session.age}\nTime: ${session.time}\n\nYour doctor will confirm shortly. You will receive a confirmation message once accepted.\n\nThis is a clinic management service. For emergencies please call 112.`;
    }
    sessions[phone] = { step: 'start' };
  }

  else if (session.step === 'menu' && msg === '2') {
    const { data } = await supabase
      .from('Appointments')
      .select('*')
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const apt = data[0];
      reply = `Your latest appointment:\n\nName: ${apt.name}\nTime: ${apt.time}\nStatus: ${apt.status || 'Pending confirmation'}\n\nReply Hi to go back to main menu.`;
    } else {
      reply = `No appointments found. Reply 1 to book one.`;
    }
    session.step = 'menu';
  }

  else if (session.step === 'menu' && msg === '3') {
    const { data } = await supabase
      .from('Appointments')
      .select('*')
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      await supabase
        .from('Appointments')
        .update({ status: 'cancelled' })
        .eq('id', data[0].id);
      reply = `Your appointment for ${data[0].time} has been cancelled.\n\nReply 1 to book a new appointment.`;
    } else {
      reply = `No active appointments found.`;
    }
    sessions[phone] = { step: 'start' };
  }

  else {
    sessions[phone] = { step: 'start' };
    reply = `Please reply Hi to start again.`;
  }

  res.set('Content-Type', 'text/xml');
  res.send(`<Response><Message>${reply}</Message></Response>`);
});

app.post('/confirm', async (req, res) => {
  const { phone, name, time, doctorName } = req.body;

  try {
    await sendWhatsApp(
      phone,
      `Hi ${name}, your appointment has been confirmed!\n\nDoctor: ${doctorName}\nTime: ${time}\n\nPlease arrive 5 minutes early. Reply Hi to this number for any changes.`
    );
    res.json({ success: true });
  } catch (error) {
    console.error('WhatsApp send error:', error);
    res.json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Varcare bot running on port ${PORT}`));