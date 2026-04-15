const mysql = require('mysql');

const db = mysql.createConnection({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE
});

exports.getContact = (req, res) => {
  res.render('contact', {
    user: req.session.user || null
  });
};

exports.postContact = (req, res) => {

  const { name, email, phone, subject, message } = req.body;

  if (!req.session.user?.id || !req.session.user?.email) {
        req.session.alert = {
            type: 'error',
            title: 'Błąd',
            message: 'Musisz się zalogować'
        };
        return res.redirect('/login');
  }

  if (!name || !email || !subject || !message) {
    req.session.alert = {
      type: 'error',
      title: 'Błąd',
      message: 'Wypełnij wszystkie wymagane pola'
    };
    return res.redirect('/contact');
  }

  const userId = req.session.user.id;

  db.query(
    'INSERT INTO tickets (user_id, name, email, phone, subject, status) VALUES (?, ?, ?, ?, ?, "open")',
    [userId, name, email, phone || null, subject],
    (err, result) => {
      if (err) {
        console.log(err);
        req.session.alert = {
          type: 'error',
          title: 'Błąd',
          message: 'Nie udało się wysłać wiadomości. Spróbuj ponownie.'
        };
        return res.redirect('/contact');
      }

      const ticketId = result.insertId;

      db.query(
        'INSERT INTO ticket_messages (ticket_id, sender, message) VALUES (?, "user", ?)',
        [ticketId, message],
        (err2) => {
          if (err2) console.log(err2);

          req.session.alert = {
            type: 'success',
            title: 'Sukces',
            message: 'Wiadomość wysłana! Odezwiemy się wkrótce.'
          };
          res.redirect('/contact');
        }
      );
    }
  );
};

exports.getMessages = (req, res) => {
  const userId = req.session.user.id;

  db.query(
    `SELECT t.*,
       (SELECT message FROM ticket_messages WHERE ticket_id = t.id ORDER BY created_at ASC LIMIT 1) AS first_message,
       (SELECT message FROM ticket_messages WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1) AS last_message,
       (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = t.id AND sender = 'admin') AS admin_replies
     FROM tickets t
     WHERE t.user_id = ?
     ORDER BY t.updated_at DESC`,
    [userId],
    (err, tickets) => {
      if (err) {
        console.log(err);
        return res.redirect('/dashboard');
      }
      res.render('messages', {
        user: req.session.user,
        tickets,
        activeTab: 'messages'
      });
    }
  );
};

exports.getTicket = (req, res) => {
  const userId = req.session.user.id;
  const ticketId = req.params.id;

  db.query(
    'SELECT * FROM tickets WHERE id = ? AND user_id = ?',
    [ticketId, userId],
    (err, tickets) => {
      if (err || tickets.length === 0) return res.redirect('/messages');

      const ticket = tickets[0];

      db.query(
        'SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC',
        [ticketId],
        (err2, messages) => {
          if (err2) {
            console.log(err2);
            return res.redirect('/messages');
          }

          const firstMsg = messages.length > 0 ? messages[0].message : '';
          const title = firstMsg.length > 60 ? firstMsg.slice(0, 60) + '...' : firstMsg;

          res.render('ticket', {
            user: req.session.user,
            ticket,
            messages,
            ticketTitle: title,
            activeTab: 'messages'
          });
        }
      );
    }
  );
};

exports.postTicketReply = (req, res) => {
  const userId = req.session.user.id;
  const ticketId = req.params.id;
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.redirect(`/messages/${ticketId}`);
  }

  db.query(
    'SELECT id, status FROM tickets WHERE id = ? AND user_id = ?',
    [ticketId, userId],
    (err, tickets) => {
      if (err || tickets.length === 0) return res.redirect('/messages');
      if (tickets[0].status === 'closed') return res.redirect(`/messages/${ticketId}`);

      db.query(
        'INSERT INTO ticket_messages (ticket_id, sender, message) VALUES (?, "user", ?)',
        [ticketId, message.trim()],
        (err2) => {
          if (err2) {
            console.log(err2);
            return res.redirect(`/messages/${ticketId}`);
          }

          db.query(
            'UPDATE tickets SET status = "open", updated_at = NOW() WHERE id = ?',
            [ticketId]
          );

          res.redirect(`/messages/${ticketId}`);
        }
      );
    }
  );
};

exports.deleteTicket = (req, res) => {
  const userId = req.session.user.id;
  const ticketId = req.params.id;

  db.query(
    'DELETE FROM tickets WHERE id = ? AND user_id = ?',
    [ticketId, userId],
    (err) => {
      if (err) console.log(err);
      res.redirect('/messages');
    }
  );
};