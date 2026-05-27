const roleMiddleware = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ status: false, message: "Access denied" });
        }
        next();
    };
};

export default roleMiddleware;
