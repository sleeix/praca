const mysql = require('mysql');
const bcrypt = require('bcryptjs');

const db = mysql.createConnection({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE
});

function markCompletedBookings() {
  db.query(`
    UPDATE bookings
    SET status = 'completed'
    WHERE status = 'active'
      AND TIMESTAMP(date, time) < NOW()
  `);
}

exports.dashboard = (req, res) => {
    markCompletedBookings();

    const userId = req.session.user.id;

    db.query(
        'SELECT * FROM bookings WHERE user_id = ?',
        [userId],
        (err, bookings) => {
            if (err) console.log(err);

            res.render('dashboard', {
                user: req.session.user,
                bookings
            });
        }
    );
};

exports.updateProfile = async (req, res) => {
    const userId = req.session.user.id;
    const { action } = req.body;

    if (action === 'update-name') {
        const { name } = req.body;

        if (!name) {
            req.session.alert = {
                type: 'error',
                title: 'Błąd',
                message: 'Nazwa nie może być pusta'
            };
            return res.redirect('/dashboard');
        }

        db.query(
            'UPDATE users SET name = ? WHERE id = ?',
            [name, userId],
            (err) => {
                if (err) {
                    req.session.alert = {
                        type: 'error',
                        title: 'Błąd',
                        message: 'Nie udało się zmienić nazwy'
                    };
                    return res.redirect('/dashboard');
                }

                req.session.user.name = name;

                req.session.alert = {
                    type: 'success',
                    title: 'Sukces',
                    message: 'Nazwa została zaktualizowana'
                };

                return res.redirect('/dashboard');
            }
        );
    }

    if (action === 'update-email') {
        const { email } = req.body;

        if (!email) {
            req.session.alert = {
                type: 'error',
                title: 'Błąd',
                message: 'Email nie może być pusty'
            };
            return res.redirect('/dashboard');
        }

        db.query(
            'SELECT id FROM users WHERE email = ? AND id != ?',
            [email, userId],
            (err, result) => {
                if (result.length > 0) {
                    req.session.alert = {
                        type: 'error',
                        title: 'Błąd',
                        message: 'Ten adres email jest już zajęty'
                    };
                    return res.redirect('/dashboard');
                }

                db.query(
                    'UPDATE users SET email = ? WHERE id = ?',
                    [email, userId],
                    (err) => {
                        if (err) {
                            req.session.alert = {
                                type: 'error',
                                title: 'Błąd',
                                message: 'Nie udało się zmienić emaila'
                            };
                            return res.redirect('/dashboard');
                        }

                        db.query(
                            'UPDATE bookings SET email = ? WHERE user_id = ?',
                            [email, userId]
                        );

                        req.session.user.email = email;

                        req.session.alert = {
                            type: 'success',
                            title: 'Sukces',
                            message: 'Email został zaktualizowany'
                        };

                        return res.redirect('/dashboard');
                    }
                );
            }
        );
    }

    if (action === 'update-password') {
        const { oldPassword, newPassword, newPasswordConfirm } = req.body;

        if (newPassword !== newPasswordConfirm) {
            req.session.alert = {
                type: 'error',
                title: 'Błąd',
                message: 'Nowe hasła nie są takie same'
            };
            return res.redirect('/dashboard');
        }

        db.query(
            'SELECT password FROM users WHERE id = ?',
            [userId],
            async (err, result) => {

                const match = await bcrypt.compare(
                    oldPassword,
                    result[0].password
                );

                if (!match) {
                    req.session.alert = {
                        type: 'error',
                        title: 'Błąd',
                        message: 'Stare hasło jest nieprawidłowe'
                    };
                    return res.redirect('/dashboard');
                }

                const hashed = await bcrypt.hash(newPassword, 8);

                db.query(
                    'UPDATE users SET password = ? WHERE id = ?',
                    [hashed, userId],
                    (err) => {

                        if (err) {
                            req.session.alert = {
                                type: 'error',
                                title: 'Błąd',
                                message: 'Nie udało się zmienić hasła'
                            };
                            return res.redirect('/dashboard');
                        }

                        req.session.alert = {
                            type: 'success',
                            title: 'Sukces',
                            message: 'Hasło zostało zmienione'
                        };

                        return res.redirect('/dashboard');
                    }
                );
            }
        );
    }
};

exports.deleteAccount = (req, res) => {
    const userId = req.session.user.id;

    db.query(
        'DELETE FROM bookings WHERE user_id = ?',
        [userId],
        () => {
            db.query(
                'DELETE FROM users WHERE id = ?',
                [userId],
                () => {

                    req.session.destroy(() => {
                        res.render('login', {
                            alert: {
                                type: 'success',
                                title: 'Konto usunięte',
                                message: 'Twoje konto zostało usunięte'
                            }
                        });
                    });

                }
            );
        }
    );
};

exports.appointments = (req, res) => {
  markCompletedBookings();

  const userId = req.session.user.id;
  const status = req.query.status || 'active';
  const date = req.query.date || null;

  let where = ['user_id = ?', 'hidden = 0'];
  let params = [userId];

  if (['active', 'completed', 'cancelled'].includes(status)) {
    where.push('status = ?');
    params.push(status);
  }

  if (date) {
    where.push('date = ?');
    params.push(date);
  }

  const whereSQL = `WHERE ${where.join(' AND ')}`;

  const visitsSql = `
    SELECT *
    FROM bookings
    ${whereSQL}
    ORDER BY date ASC, time ASC
  `;

  const countSql = `
    SELECT
        COALESCE(SUM(status = 'active'), 0) AS activeCount,
        COALESCE(SUM(status = 'completed'), 0) AS completedCount,
        COALESCE(SUM(status = 'cancelled'), 0) AS cancelledCount
    FROM bookings
    WHERE user_id = ?
    AND hidden = 0
    `;

  db.query(visitsSql, params, (err, visits) => {
    if (err) {
      console.log(err);
      return res.redirect('/appointments');
    }

    db.query(countSql, [userId], (err, counts) => {
      if (err) {
        console.log(err);
        return res.redirect('/appointments');
      }

      res.render('appointments', {
        user: req.session.user,
        visits,
        currentStatus: status,
        selectedDate: date,
        counts: counts[0]
      });
    });
  });
};

exports.cancelBooking = (req, res) => {
  const userId = req.session.user.id;
  const bookingId = req.params.id;

  db.query(
    `
    UPDATE bookings
    SET status = 'cancelled'
    WHERE id = ? AND user_id = ? AND status = 'active'
    `,
    [bookingId, userId],
    (err) => {
      if (err) console.log(err);
      res.redirect('/appointments');
    }
  );
};

exports.hideBooking = (req, res) => {
  const userId = req.session.user.id;
  const bookingId = req.params.id;

  db.query(
    `
    UPDATE bookings
    SET hidden = 1
    WHERE id = ? 
      AND user_id = ? 
      AND status IN ('completed', 'cancelled')
    `,
    [bookingId, userId],
    (err) => {
      if (err) console.log(err);
      res.redirect('/appointments?status=' + req.query.status);
    }
  );
};