// Create this file to test each import individually
// Run: node test_imports.js

console.log('Testing imports...\n');

// Test 1: Device Database
try {
    console.log('1. Testing deviceDatabase import...');
    const { deviceDatabase } = require('./data/deviceDatabase'); // Adjust path as needed
    console.log('   ✓ deviceDatabase imported successfully');
    console.log('   ✓ Found', Object.keys(deviceDatabase).length, 'devices');
    console.log('   ✓ First few devices:', Object.keys(deviceDatabase).slice(0, 3));
} catch (error) {
    console.log('   ✗ deviceDatabase import failed:', error.message);
}

// Test 2: Game Enums
try {
    console.log('\n2. Testing gameEnums import...');
    const { Game, PlayStyle, ExperienceLevel, FingerCount } = require('./types/gameEnums'); // Adjust path
    console.log('   ✓ gameEnums imported successfully');
    console.log('   ✓ Game:', Game);
    console.log('   ✓ PlayStyle values:', Object.values(PlayStyle));
} catch (error) {
    console.log('   ✗ gameEnums import failed:', error.message);
}

// Test 3: WebsiteAPI
try {
    console.log('\n3. Testing WebsiteAPI import...');
    const { WebsiteAPI } = require('./utils/websiteAPI'); // Adjust path
    console.log('   ✓ WebsiteAPI imported successfully');
    
    // Test static method with a mock device
    const mockDevice = { name: 'Test Device', refreshRate: 60, touchSamplingRate: 120, processorScore: 80, gpuScore: 80 };
    const multiplier = WebsiteAPI.calculateBaseMultiplier(mockDevice);
    console.log('   ✓ calculateBaseMultiplier test result:', multiplier);
} catch (error) {
    console.log('   ✗ WebsiteAPI import failed:', error.message);
}

// Test 4: ResultFormatter
try {
    console.log('\n4. Testing ResultFormatter import...');
    const { ResultFormatter } = require('./utils/formatters'); // Adjust path
    console.log('   ✓ ResultFormatter imported successfully');
    
    // Test device info formatting with a mock device
    const mockDevice = { name: 'Test Device', refreshRate: 60, touchSamplingRate: 120, processorScore: 80 };
    const deviceInfo = ResultFormatter.formatDeviceInfo(mockDevice);
    console.log('   ✓ formatDeviceInfo test result:', deviceInfo);
} catch (error) {
    console.log('   ✗ ResultFormatter import failed:', error.message);
    console.log('   ✗ Full error:', error.stack);
}

// Test 5: SensitivityHandler (this is where the error occurs)
try {
    console.log('\n5. Testing SensitivityHandler import...');
    const { SensitivityHandler } = require('./utils/SensitivityHandler'); // Adjust path
    console.log('   ✓ SensitivityHandler imported successfully');
} catch (error) {
    console.log('   ✗ SensitivityHandler import failed:', error.message);
    console.log('   ✗ Full error:', error.stack);
}

console.log('\nTest complete. Check which imports failed.');
