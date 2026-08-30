package com.jheckbot.wrapper

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.inputmethod.EditorInfo
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var urlInputContainer: LinearLayout
    private lateinit var urlInput: EditText
    private lateinit var saveButton: Button
    private lateinit var appConfig: AppConfig

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        urlInputContainer = findViewById(R.id.urlInputContainer)
        urlInput = findViewById(R.id.urlInput)
        saveButton = findViewById(R.id.saveButton)
        appConfig = AppConfig(this)

        createNotificationChannel()
        requestNotificationPermission()
        configureWebView()
        bindInputActions()

        val targetUrl = getTargetUrl()
        checkAndLoad(targetUrl)
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleNotificationIntent(intent)
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == NOTIFICATION_PERMISSION_REQUEST_CODE) {
            // Permission state is now reflected by NotificationManagerCompat.
            // The web app will read it through AndroidBridge.permission().
        }
    }

    private fun configureWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            setSupportZoom(false)
        }
        webView.webChromeClient = WebChromeClient()
        webView.addJavascriptInterface(
            NotificationBridge(this, NOTIFICATION_CHANNEL_ID, R.drawable.ic_notification),
            JS_BRIDGE_NAME
        )
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                view?.evaluateJavascript(NOTIFICATION_SHIM, null)
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                if (request?.isForMainFrame == true) {
                    showUrlInput(getSavedUrl(), "Could not load page")
                }
            }

            override fun onReceivedHttpError(
                view: WebView?,
                request: WebResourceRequest?,
                errorResponse: WebResourceResponse?
            ) {
                if (request?.isForMainFrame == true) {
                    val status = errorResponse?.statusCode ?: 0
                    showUrlInput(getSavedUrl(), "Server returned HTTP $status")
                }
            }
        }
    }

    private fun bindInputActions() {
        saveButton.setOnClickListener { onSaveUrl() }
        urlInput.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_DONE) {
                onSaveUrl()
                true
            } else {
                false
            }
        }
    }

    private fun getSavedUrl(): String {
        return getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
            .getString(URL_KEY, appConfig.config.baseUrl) ?: appConfig.config.baseUrl
    }

    private fun saveUrl(url: String) {
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
            .edit()
            .putString(URL_KEY, url)
            .apply()
    }

    private fun getTargetUrl(): String {
        val path = intent.getStringExtra(EXTRA_NOTIFICATION_URL)
        val saved = getSavedUrl()
        if (path.isNullOrEmpty()) return saved
        return getBaseUrl(saved) + path
    }

    private fun getBaseUrl(url: String): String {
        return try {
            val parsed = URL(url)
            val port = if (parsed.port != -1) ":${parsed.port}" else ""
            "${parsed.protocol}://${parsed.host}$port"
        } catch (e: Exception) {
            url
        }
    }

    private fun handleNotificationIntent(intent: Intent?) {
        val path = intent?.getStringExtra(EXTRA_NOTIFICATION_URL) ?: return
        val saved = getSavedUrl()
        val target = getBaseUrl(saved) + path
        if (webView.visibility == View.VISIBLE) {
            webView.loadUrl(target)
        } else {
            checkAndLoad(target)
        }
    }

    private fun isValidUrl(url: String): Boolean {
        return url.startsWith("http://") || url.startsWith("https://")
    }

    private fun onSaveUrl() {
        val entered = urlInput.text.toString().trim()
        if (!isValidUrl(entered)) {
            urlInput.error = "URL must start with http:// or https://"
            return
        }
        saveUrl(entered)
        checkAndLoad(entered)
    }

    private fun checkAndLoad(url: String) {
        resetUiForLoading()

        Thread {
            try {
                val connection = URL(url).openConnection() as HttpURLConnection
                connection.requestMethod = "GET"
                connection.connectTimeout = 5000
                connection.readTimeout = 5000
                connection.instanceFollowRedirects = true
                val status = connection.responseCode
                connection.disconnect()

                runOnUiThread {
                    if (status in HTTP_OK..HTTP_OK_LAST) {
                        showWebView()
                        webView.loadUrl(url)
                    } else {
                        showUrlInput(url, "Server returned HTTP $status")
                    }
                }
            } catch (e: Exception) {
                runOnUiThread {
                    showUrlInput(url, e.message ?: "Could not reach server")
                }
            }
        }.start()
    }

    private fun resetUiForLoading() {
        webView.stopLoading()
        webView.visibility = View.GONE
        urlInputContainer.visibility = View.GONE
    }

    private fun showWebView() {
        urlInputContainer.visibility = View.GONE
        webView.visibility = View.VISIBLE
    }

    private fun showUrlInput(currentUrl: String, message: String? = null) {
        webView.stopLoading()
        webView.visibility = View.GONE
        urlInputContainer.visibility = View.VISIBLE
        urlInput.setText(currentUrl)
        urlInput.setSelection(currentUrl.length)
        if (!message.isNullOrEmpty()) {
            Toast.makeText(this, message, Toast.LENGTH_LONG).show()
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = getString(R.string.notification_channel_name)
            val descriptionText = getString(R.string.notification_channel_description)
            val importance = NotificationManager.IMPORTANCE_DEFAULT
            val channel = NotificationChannel(NOTIFICATION_CHANNEL_ID, name, importance).apply {
                description = descriptionText
            }
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            when {
                ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED -> {
                    // already granted
                }
                else -> {
                    ActivityCompat.requestPermissions(
                        this,
                        arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                        NOTIFICATION_PERMISSION_REQUEST_CODE
                    )
                }
            }
        }
    }

    companion object {
        private const val PREFS_NAME = "jheckbot_wrapper"
        private const val URL_KEY = "server_url"
        private const val HTTP_OK = 200
        private const val HTTP_OK_LAST = 299

        private val NOTIFICATION_SHIM = """
            (function() {
                'use strict';
                if (window.Notification && window.Notification.__jheckbotNative) return;
                function JheckBotNotification(title, options) {
                    this.title = title;
                    this.body = (options && options.body) ? options.body : '';
                    this.tag = (options && options.tag) ? options.tag : '';
                    this.data = (options && options.data) ? options.data : {};
                    this.url = (options && (options.url || (options.data && options.data.url))) ? (options.url || options.data.url) : '';
                    this.onclick = null;
                    if (window.AndroidBridge && window.AndroidBridge.showNotification) {
                        window.AndroidBridge.showNotification(this.title, this.body, this.tag, this.url);
                    }
                }
                JheckBotNotification.prototype.close = function() {};
                JheckBotNotification.__jheckbotNative = true;
                Object.defineProperty(JheckBotNotification, 'permission', {
                    get: function() {
                        if (window.AndroidBridge && window.AndroidBridge.permission) {
                            return window.AndroidBridge.permission();
                        }
                        return 'default';
                    },
                    configurable: false
                });
                JheckBotNotification.requestPermission = function() {
                    return new Promise(function(resolve) {
                        if (window.AndroidBridge && window.AndroidBridge.requestPermission) {
                            resolve(window.AndroidBridge.requestPermission());
                        } else {
                            resolve('default');
                        }
                    });
                };
                window.Notification = JheckBotNotification;
            })();
        """.trimIndent()
    }
}
