const jwt = require('jsonwebtoken');

// Authentication middleware for protected routes
const auth = (req, res, next) => {
  try {
    // Get token from Authorization header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      console.log('❌ No token provided');
      return res.status(401).json({ message: 'No authentication token provided. Access denied.' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // ✅ Add detailed logging
    // console.log('✅ Token verified:', {
    //   userId: decoded.userId,
    //   role: decoded.role,
    //   exp: new Date(decoded.exp * 1000).toISOString()
    // });
    
    // Add user info to request object
    req.user = decoded;
    
    // Continue to next middleware/route handler
    next();
  } catch (error) {
    console.error('❌ Auth error:', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token. Access denied.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired. Please login again.' });
    }
    res.status(401).json({ message: 'Authentication failed.' });
  }
};

module.exports = auth;