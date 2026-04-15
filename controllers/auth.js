const mysql = require("mysql");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const db = mysql.createConnection({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE
});

exports.register = async (req, res) => {
    const { name, email, password, passwordConfirm } = req.body;

    if (!name || !email || !password || !passwordConfirm) {
        return res.render('register', {
                alert: {
                    type: 'error',
                    title: 'Błąd',
                    message: 'Uzupełnij wszystkie pola'
                }
            });
    }

    if (password !== passwordConfirm) {
        return res.render('register', {
                alert: {
                    type: 'error',
                    title: 'Błąd',
                    message: 'Hasła nie są takie same'
                }
            });
    }

    db.query('SELECT email FROM users WHERE email = ?', [email], async (error, results) => {
        if (results.length > 0) {
            return res.render('register', {
                alert: {
                    type: 'error',
                    title: 'Błąd',
                    message: 'Na podany adres email zostało już utworzone konto'
                }
            });
        }

        const hashedPassword = await bcrypt.hash(password, 8);

        db.query(
            'INSERT INTO users SET ?',
            { name, email, password: hashedPassword },
            (error) => {
                if (error) {
                    console.log(error);
                } else {
                    return res.render('login', {
                        alert: {
                            type: 'success',
                            title: 'Sukces',
                            message: 'Konto utoworzone! Możesz się zalogwać'
                        }
                    });
                }
            }
        );
    });
};

exports.login = (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.render('login', {
            alert: {
                type: 'error',
                title: 'Błąd',
                message: 'Uzupełnij wszystkie pola'
            }
        });
    }

    db.query(
        'SELECT * FROM users WHERE email = ?',
        [email],
        async (error, results) => {
            if (error) {
                console.log(error);
                return;
            }

            if (!results || results.length === 0) {
                return res.render('login', {
                    alert: {
                        type: 'error',
                        title: 'Błąd',
                        message: 'Nieprawidłowy email lub hasło'
                    }
                });
            }

            const isMatch = await bcrypt.compare(
                password,
                results[0].password
            );

            if (!isMatch) {
                return res.render('login', {
                    alert: {
                        type: 'error',
                        title: 'Błąd',
                        message: 'Nieprawidłowy email lub hasło'
                    }
                });
            }

            req.session.user = {
                id: results[0].id,
                name: results[0].name,
                email: results[0].email,
                role: results[0].role
            };

            console.log('SESJA:', req.session.user);

            res.redirect('/');
        }
    );
};