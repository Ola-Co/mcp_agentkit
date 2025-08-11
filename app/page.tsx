'use client';

import { useEffect, useRef } from 'react';

/**
 * Home page for the AgentKit Quickstart
 *
 * @returns {React.ReactNode} The home page
 */
export default function Home() {
  // Ref for the messages container
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Function to scroll to the bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Auto-scroll whenever messages change
  useEffect(() => {
    scrollToBottom();
  }, []);
  const onSendMessage = async () => {
    // Placeholder for sending message logic
    console.log('Send message clicked');

    try {
      // Get registration options
      const optionsResponse = await fetch('/api/whatsapp/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry: [
            {
              changes: [
                {
                  value: {
                    messages: [
                      { from: '14084429812', text: { body: 'wallet info' } },
                    ],
                  },
                },
              ],
            },
          ],
        }),
      });

      if (!optionsResponse.ok) {
        throw new Error('Failed to process');
      }
    } catch (error) {
      console.error(' error:', error);
    } finally {
    }
  };

  return (
    <div className="flex flex-col flex-grow items-center justify-center text-black dark:text-white w-full h-full">
      <div className="w-full max-w-2xl h-[70vh] bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 flex flex-col">
        {/* Chat Messages */}
        <div className="flex-grow overflow-y-auto space-y-3 p-2">
          {/* Invisible div to track the bottom */}
          <div ref={messagesEndRef} />
        </div>
        <button onClick={onSendMessage}>Send message</button>
        {/* Input Box */}
      </div>
    </div>
  );
}
