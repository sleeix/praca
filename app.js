const express = require('express');
const session = require('express-session');
const path = require('path');
const mysql = require('mysql');
const dotenv = require('dotenv');
const { engine } = require('express-handlebars');

dotenv.config({ path: './config.env' });

const app = express();

const db = mysql.createConnection({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE
});

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

app.engine(
  'hbs',
  engine({
    extname: 'hbs',
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, 'views/layouts'),
    partialsDir: path.join(__dirname, 'views/partials'),
    helpers: {
      eq: (a, b) => a === b,
      or: (a, b) => a || b,

      formatDatePL: date =>
        date
          ? new Intl.DateTimeFormat('pl-PL', {
              day: '2-digit',
              month: 'long',
              year: 'numeric'
            }).format(new Date(date))
          : '',

      formatTimeHM: time =>
        time ? time.toString().slice(0, 5) : '',

      formatDateTimePL: date =>
        date
          ? new Intl.DateTimeFormat('pl-PL', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }).format(new Date(date))
          : ''
    }
  })
);

app.set('view engine', 'hbs');

app.use(
  session({
    secret: process.env.DATABASE_SECRET,
    resave: false,
    saveUninitialized: true
  })
);

app.use((req, res, next) => {
  res.locals.user = req.session.user;
  next();
});

app.use((req, res, next) => {
  res.locals.alert = req.session.alert;
  req.session.alert = null;
  next();
});

app.use('/', require('./routes/pages'));
app.use('/auth', require('./routes/auth'));
app.use('/admin', require('./routes/admin'));

db.connect(err => {
  if (err) console.log(err);
  else console.log('Baza danych połączona!');
});

app.listen(5000, () => {
  console.log('Serwer pracuje na porcie 5000');
});