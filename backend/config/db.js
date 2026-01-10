const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // MongoDB Atlas connection options (updated for latest Mongoose)
    const options = {
      // Remove deprecated options - modern Mongoose handles these automatically
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    };

    const conn = await mongoose.connect(process.env.MONGODB_URI, options);

    console.log(`✅ MongoDB Connected Successfully!`);
    console.log(`🏠 Host: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    console.log(`🌐 Connection State: ${conn.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('📴 MongoDB connection closed through app termination');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    
    // Check for common Atlas connection issues
    if (error.message.includes('ETIMEDOUT')) {
      console.log('💡 Tip: Check your network connection and MongoDB Atlas network access settings');
    }
    if (error.message.includes('authentication failed')) {
      console.log('💡 Tip: Verify your MongoDB Atlas username and password in the .env file');
    }
    if (error.message.includes('bad auth')) {
      console.log('💡 Tip: Make sure your MongoDB Atlas user has proper permissions');
    }
    
    process.exit(1);
  }
};

module.exports = connectDB;