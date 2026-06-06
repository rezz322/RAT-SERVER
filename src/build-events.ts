import { EventEmitter } from 'events';

/**
 * Глобальный EventEmitter для событий сборки APK.
 * ApkService эмитирует события, AppGateway транслирует их в WebSocket.
 */
export const buildEvents = new EventEmitter();
