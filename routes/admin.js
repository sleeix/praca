const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const isLoggedIn = require('../middleware/auth');
const { isAdmin } = require('../middleware/adminAuth');

router.get('/', isLoggedIn, isAdmin, adminController.dashboard);
router.post('/cancel-booking/:id', adminController.cancelBookingAdmin);

router.get('/messages', isLoggedIn, isAdmin, adminController.getMessages);
router.get('/messages/:id', isLoggedIn, isAdmin, adminController.getTicket);
router.post('/messages/:id/reply', isLoggedIn, isAdmin, adminController.postTicketReply);
router.post('/messages/:id/close', isLoggedIn, isAdmin, adminController.closeTicket);
router.post('/messages/:id/delete', isLoggedIn, isAdmin, adminController.deleteTicket);

module.exports = router;