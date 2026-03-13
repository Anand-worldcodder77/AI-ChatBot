const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    // User ID (Baad mein jab hum login lagayenge tab kaam aayega)
    userId: { type: String, default: 'guest_user' }, 
    
    // AI ne jo summary aur details nikali thi
    summary: { type: String, required: true },
    abnormal_values: { type: [String], default: [] },
    advice: { type: String },
    disclaimer: { type: String },

    // Chat history (Taaki refresh karne par purani baatein yaad rahein)
    chatHistory: [
        {
            role: { type: String, enum: ['user', 'model'] },
            text: { type: String }
        }
    ],
    
    // Kab save hui thi
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Report', reportSchema);