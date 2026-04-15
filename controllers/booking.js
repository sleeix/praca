const mysql = require('mysql');

const db = mysql.createConnection({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE
});

const SERVICE_DURATIONS = {
    'Klasyczne strzyżenie męskie': 30,
    'Strzyżenie włosów + mycie': 60,
    'Strzyżenie brody': 30,
    'Golenie na mokro': 30,
    'Golenie głowy': 30,
    'Combo: włosy + broda': 90,
    'Fade / Skin Fade cięcie': 60,
    'Hot Towel Shave': 60,
    'Barber styling włosów + produkt': 30,
    'Koloryzacja brody lub włosów': 60
};

exports.getServiceDurations = (req, res) => {
    res.json(SERVICE_DURATIONS);
};

function timeToMinutes(time) {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}

function timesOverlap(aStart, aDur, bStart, bDur) {
    return aStart < bStart + bDur && bStart < aStart + aDur;
}

exports.createBooking = (req, res) => {
    const { service, fullname, phone, date, time } = req.body;

    if (!service || !fullname || !phone || !date || !time) {
        req.session.alert = {
            type: 'error',
            title: 'Błąd',
            message: 'Uzupełnij wszystkie pola'
        };
        return res.redirect('/service');
    }

    if (!req.session.user?.id || !req.session.user?.email) {
        req.session.alert = {
            type: 'error',
            title: 'Błąd',
            message: 'Musisz się zalogować'
        };
        return res.redirect('/login');
    }

    const userId = req.session.user.id;
    const email = req.session.user.email;
    const newDuration = SERVICE_DURATIONS[service];
    const newStart = timeToMinutes(time);

    db.query(
        `SELECT TIME_FORMAT(time, '%H:%i') as time, service 
         FROM bookings 
         WHERE date = ? AND status = "active" AND hidden = 0`,
        [date],
        (err, results) => {

            if (err) return res.redirect('/service');

            const hasConflict = results.some(b => {
                const existingStart = timeToMinutes(b.time);
                const existingDuration = SERVICE_DURATIONS[b.service];
                return timesOverlap(newStart, newDuration, existingStart, existingDuration);
            });

            if (hasConflict) {
                req.session.alert = {
                    type: 'error',
                    title: 'Błąd',
                    message: 'Termin jest zajęty'
                };
                return res.redirect('/service');
            }

            db.query(
                `INSERT INTO bookings 
                (user_id, service, fullname, email, phone, date, time, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
                [userId, service, fullname, email, phone, date, time],
                () => {
                    req.session.alert = {
                        type: 'success',
                        title: 'Sukces',
                        message: 'Wizyta umówiona'
                    };
                    return res.redirect('/service');
                }
            );
        }
    );
};

exports.getBookedTimes = (req, res) => {
    const { date } = req.query;
    if (!date) return res.json([]);

    db.query(
        `SELECT 
            TIME_FORMAT(time, '%H:%i') as time, 
            service 
         FROM bookings 
         WHERE DATE(date) = ? 
         AND status = 'active' 
         AND (hidden = 0 OR hidden IS NULL)`,
        [date],
        (err, results) => {

            if (err) {
                console.log(err);
                return res.json([]);
            }

            const bookings = results.map(b => ({
                time: b.time,
                duration: SERVICE_DURATIONS[b.service]
            }));

            res.json(bookings);
        }
    );
};