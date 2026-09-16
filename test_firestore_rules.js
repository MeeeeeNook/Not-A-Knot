const { initializeApp, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');

// We can't easily unit test this here without full emulator setup.
// Let's just create a script that accesses the database with the real token to see the error.
