package com.jheckbot.wrapper

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.webkit.JavascriptInterface
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

/**
 * JavaScript bridge for notifications. The WebView injects an object named
 * `AndroidBridge` so the web app can call `new Notification(...)` and have
 * the request surface as a native Android status-bar notification.
 */
class NotificationBridge(
    private val context: Context,
    private val channelId: String,
    private val smallIcon: Int
) {

    @JavascriptInterface
    fun permission(): String {
        return if (NotificationManagerCompat.from(context).areNotificationsEnabled()) "granted" else "denied"
    }

    @JavascriptInterface
    fun requestPermission(): String {
        return permission()
    }

    @JavascriptInterface
    fun showNotification(title: String, body: String, tag: String, url: String) {
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return

        val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(EXTRA_NOTIFICATION_URL, url)
        } ?: return

        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notificationTag = tag.takeIf { it.isNotBlank() } ?: DEFAULT_NOTIFICATION_TAG
        val notificationId = if (tag.isNotBlank()) tag.hashCode() else System.currentTimeMillis().toInt()

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(smallIcon)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .build()

        NotificationManagerCompat.from(context).notify(notificationTag, notificationId, notification)
    }

    companion object {
        private const val DEFAULT_NOTIFICATION_TAG = "jheckbot"
    }
}
