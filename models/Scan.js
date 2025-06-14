const mongoose = require('mongoose');

const ScanSchema = new mongoose.Schema({
  classId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Class',
    required: true
  },
  stationId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Station',
    required: true
  },
  scannedAt: {
    type: Date,
    default: Date.now
  },
  scannedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }
});

// Compound index to prevent duplicate scans
ScanSchema.index({ classId: 1, stationId: 1 }, { unique: true });

module.exports = mongoose.model('Scan', ScanSchema);