// Admin-only authentication middleware
const adminAuth = (req, res, next) => {
  try {
    // Check if user is authenticated (auth middleware should run first)
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Check if user has admin role
    if (req.user.role !== 'admin') {
      console.log(`⚠️ Access denied for user role: ${req.user.role}`);
      return res.status(403).json({ 
        message: 'Admin access required',
        currentRole: req.user.role 
      });
    }

    // console.log(`✅ Admin access granted: ${req.user.userId}`);
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = adminAuth;