require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const adminEmail = 'admin@waste2wealth.com';
    
    // Check if admin exists
    let admin = await User.findOne({ email: adminEmail });
    
    if (admin) {
      console.log('⚠️ Admin user already exists');
      // Update role to admin if it's not
      if (admin.role !== 'admin') {
        admin.role = 'admin';
        await admin.save();
        console.log('✅ Updated user role to admin');
      }
    } else {
      // Create new admin user
      admin = new User({
        name: 'Admin',
        email: adminEmail,
        password: 'admin123', // Change this!
        role: 'admin'
      });
      await admin.save();
      console.log('✅ Admin user created');
    }

    console.log('\nAdmin Credentials:');
    console.log('Email:', adminEmail);
    console.log('Password: admin123');
    console.log('\n⚠️ IMPORTANT: Change the password after first login!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createAdmin();