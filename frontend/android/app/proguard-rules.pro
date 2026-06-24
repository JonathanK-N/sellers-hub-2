# AfriMarket ProGuard Rules
# Capacitor
-keep class com.getcapacitor.** { *; }
-keep class com.getcapacitor.plugin.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }

# MainActivity
-keep class cd.cognito.afrimarket.** { *; }

# WebView / JavaScript bridge
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface

# Capacitor plugins
-keep class * extends com.getcapacitor.Plugin { *; }

# AndroidX
-keep class androidx.** { *; }
-dontwarn androidx.**

# Google Services
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# Coroutines
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}

# OkHttp (réseau)
-dontwarn okhttp3.**
-dontwarn okio.**

# General
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
-keep public class * extends java.lang.Exception
