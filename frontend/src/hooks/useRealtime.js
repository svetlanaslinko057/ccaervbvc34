import { useEffect, useRef } from 'react';
import { getSocket, joinRooms } from '../lib/socket';

/**
 * Hook to join realtime rooms
 * @param {string[]} rooms - Array of room names to join
 */
export function useRealtimeRooms(rooms) {
  const joinedRef = useRef(false);

  useEffect(() => {
    if (!rooms || rooms.length === 0) return;
    
    const socket = getSocket();
    
    const doJoin = () => {
      if (!joinedRef.current) {
        joinRooms(rooms);
        joinedRef.current = true;
      }
    };

    if (socket.connected) {
      doJoin();
    } else {
      socket.once('connect', doJoin);
    }

    return () => {
      joinedRef.current = false;
    };
  }, [JSON.stringify(rooms)]);
}

/**
 * Hook to subscribe to realtime events
 * @param {Object} handlers - { eventName: (payload) => void }
 */
export function useRealtimeEvents(handlers) {
  useEffect(() => {
    const socket = getSocket();

    // Subscribe to events
    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    // Cleanup
    return () => {
      Object.entries(handlers).forEach(([event, handler]) => {
        socket.off(event, handler);
      });
    };
  }, []);
}

/**
 * Hook to setup realtime for a specific role
 * @param {string} userId 
 * @param {string} role 
 * @param {string[]} extraRooms - Optional extra rooms (like project IDs)
 */
export function useRealtimeSetup(userId, role, extraRooms = []) {
  useEffect(() => {
    if (!userId || !role) return;

    const rooms = [
      `user:${userId}`,
      `role:${role}`,
      ...extraRooms
    ];

    joinRooms(rooms);
    console.log('[Realtime] Joined rooms:', rooms);
  }, [userId, role, JSON.stringify(extraRooms)]);
}

export default useRealtimeEvents;
