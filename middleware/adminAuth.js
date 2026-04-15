exports.isAdmin = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/dashboard');
    }
    next();
};