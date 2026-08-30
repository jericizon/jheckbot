package com.jheckbot.wrapper

import android.content.Context
import org.json.JSONObject

/**
 * Reads the bundled assets/config.json for the WebView base URL.
 * Falls back to the default LAN URL if the asset is missing or malformed.
 */
class AppConfig(private val context: Context) {

    data class Config(
        val baseUrl: String,
    )

    val config: Config by lazy { loadConfig() }

    private fun loadConfig(): Config {
        return try {
            val json = context.assets.open(CONFIG_FILE).bufferedReader().use { it.readText() }
            val obj = JSONObject(json)
            val baseUrl = obj.optString("baseUrl", DEFAULT_URL).trim()
                .ifEmpty { DEFAULT_URL }
            Config(baseUrl)
        } catch (e: Exception) {
            Config(DEFAULT_URL)
        }
    }

    companion object {
        private const val CONFIG_FILE = "config.json"
        private const val DEFAULT_URL = "http://192.168.18.12:8800"
    }
}
