// Enhanced authentication page with success callback
// app/auth/page.tsx (Enhanced version)
'use client';

import { useState, useEffect } from 'react';
import {
  startRegistration,
  startAuthentication,
} from '@simplewebauthn/browser';

export default function AuthPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  //   const [isRegistered, setIsRegistered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<'register' | 'login'>('login');
  const [authSuccess, setAuthSuccess] = useState(false);

  useEffect(() => {
    // Get phone number from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const phone = urlParams.get('phone');
    if (phone) {
      setPhoneNumber(phone);
    }
  }, []);

  const handleRegister = async () => {
    if (!phoneNumber) {
      setMessage('Please enter your phone number');
      return;
    }

    setLoading(true);
    try {
      // Get registration options
      const optionsResponse = await fetch('/api/auth/passkey/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });

      if (!optionsResponse.ok) {
        throw new Error('Failed to get registration options');
      }

      const options = await optionsResponse.json();

      // Start WebAuthn registration
      const credential = await startRegistration(options);

      // Verify registration
      const verificationResponse = await fetch('/api/auth/passkey/register', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, credential }),
      });

      const verification = await verificationResponse.json();

      if (verification.verified) {
        setMessage('Registration successful! You can now authenticate.');
        // setIsRegistered(true);
        setMode('login');
      } else {
        setMessage('Registration failed. Please try again.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setMessage('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!phoneNumber) {
      setMessage('Please enter your phone number');
      return;
    }

    setLoading(true);
    try {
      // Get authentication options
      const optionsResponse = await fetch('/api/auth/passkey/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });

      if (!optionsResponse.ok) {
        const error = await optionsResponse.json();
        if (optionsResponse.status === 404) {
          setMessage('No account found. Please register first.');
          setMode('register');
          return;
        }
        throw new Error(error.error || 'Failed to get authentication options');
      }

      const options = await optionsResponse.json();

      // Start WebAuthn authentication
      const credential = await startAuthentication(options);

      // Verify authentication
      const verificationResponse = await fetch(
        '/api/auth/passkey/authenticate',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber, credential }),
        }
      );

      const verification = await verificationResponse.json();

      if (verification.verified) {
        // Store the authentication success on the server
        const authSuccessResp = await fetch('/api/auth/success', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phoneNumber,
            token: verification.token,
          }),
        });
        const authSuccessData = await authSuccessResp.json();
        setMessage(`Authentication successful!  \n ${authSuccessData.message}`);
        setAuthSuccess(true);

        // Store token locally for demo purposes
        localStorage.setItem('auth_token', verification.token);
        localStorage.setItem('phone_number', phoneNumber);
      } else {
        setMessage('Authentication failed. Please try again.');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      setMessage('Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-6">
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            WhatsApp Crypto Bot
          </h1>
          <p className="text-gray-600">Secure authentication with passkeys</p>
        </div>

        {!authSuccess ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                placeholder="+1234567890"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => setMode('login')}
                className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                  mode === 'login'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Login
              </button>
              <button
                onClick={() => setMode('register')}
                className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                  mode === 'register'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Register
              </button>
            </div>

            <button
              onClick={mode === 'register' ? handleRegister : handleLogin}
              disabled={loading || !phoneNumber}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  {mode === 'register'
                    ? 'Register with Passkey'
                    : 'Login with Passkey'}
                </>
              )}
            </button>

            {message && (
              <div
                className={`p-4 rounded-md ${
                  message.includes('successful')
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                <div className="whitespace-pre-line text-sm">{message}</div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-green-800">
              Authentication Successful!
            </h2>
            <p className="text-gray-600">
              You can now return to WhatsApp and use wallet commands.
            </p>
            <div className="bg-blue-50 p-4 rounded-md text-left">
              <h3 className="font-medium text-blue-900 mb-2">
                Available Commands:
              </h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>get my balance</li>
                <li>get wallet address</li>
                <li>send 0.1 ETH to 0x...</li>
                <li>swap 100 USDC for ETH</li>
                <li>/logout to sign out</li>
                <li>{message}</li>
              </ul>
            </div>
          </div>
        )}

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>
            🔒 Your authentication is secured with biometric verification or
            passkeys. No passwords needed!
          </p>
        </div>
      </div>
    </div>
  );
}
