const express = require('express');
const router = express.Router();

const isLoggedIn = require('../middleware/auth');
const dashboardController = require('../controllers/dashboard');
const bookingController = require('../controllers/booking');
const contactController = require('../controllers/contactController');

router.get('/', (req, res) => res.render('index'));
router.get('/login', (req, res) => res.render('login'));
router.get('/register', (req, res) => res.render('register'));
router.get('/service', (req, res) => res.render('service'));

router.get('/contact', contactController.getContact);
router.post('/contact', contactController.postContact);

router.post('/booking', bookingController.createBooking);
router.get('/booking/booked-times', bookingController.getBookedTimes);
router.get('/booking/service-durations', bookingController.getServiceDurations);

router.get('/dashboard', isLoggedIn, dashboardController.dashboard);
router.post('/dashboard/profile', isLoggedIn, dashboardController.updateProfile);
router.post('/dashboard/delete-account', isLoggedIn, dashboardController.deleteAccount);

router.get('/appointments', isLoggedIn, dashboardController.appointments);
router.post('/appointments/cancel/:id', isLoggedIn, dashboardController.cancelBooking);
router.post('/appointments/hide/:id', dashboardController.hideBooking);

router.get('/messages', isLoggedIn, contactController.getMessages);
router.get('/messages/:id', isLoggedIn, contactController.getTicket);
router.post('/messages/:id/reply', isLoggedIn, contactController.postTicketReply);
router.post('/messages/:id/delete', isLoggedIn, contactController.deleteTicket);

module.exports = router;