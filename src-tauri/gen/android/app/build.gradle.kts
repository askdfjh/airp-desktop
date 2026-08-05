import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("rust")
}

val tauriProperties = Properties().apply {
    val propFile = file("tauri.properties")
    if (propFile.exists()) {
        propFile.inputStream().use { load(it) }
    }
}

android {
    compileSdk = 36
    namespace = "com.airp.app"
    defaultConfig {
        manifestPlaceholders["usesCleartextTraffic"] = "false"
        applicationId = "com.airp.app"
        minSdk = 24
        targetSdk = 36
        versionCode = tauriProperties.getProperty("tauri.android.versionCode", "1").toInt()
        versionName = tauriProperties.getProperty("tauri.android.versionName", "1.0")
    }
    buildTypes {
        getByName("debug") {
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            isDebuggable = true
            isJniDebuggable = true
            isMinifyEnabled = false
            packaging {                jniLibs.keepDebugSymbols.add("*/arm64-v8a/*.so")
                jniLibs.keepDebugSymbols.add("*/armeabi-v7a/*.so")
                jniLibs.keepDebugSymbols.add("*/x86/*.so")
                jniLibs.keepDebugSymbols.add("*/x86_64/*.so")
            }
        }
        getByName("release") {
            isMinifyEnabled = true
            // 正式 keystore 签名（keystore 与密码在本地 gradle.properties，gen/ 目录已被 gitignore，不会入库）
            val ksPath = project.findProperty("airp.android.keystorePath") as String?
            val ksPass = project.findProperty("airp.android.keystorePass") as String?
            val ksAlias = project.findProperty("airp.android.keystoreAlias") as String?
            val ksAliasPass = project.findProperty("airp.android.keystoreAliasPass") as String?
            if (ksPath != null && ksPass != null) {
                signingConfig = signingConfigs.create("release") {
                    storeFile = file(ksPath)
                    storePassword = ksPass
                    keyAlias = ksAlias ?: "airp"
                    keyPassword = ksAliasPass ?: ksPass
                }
            } else if (project.findProperty("airp.android.allowDebugReleaseSigning") == "true") {
                // 无正式 keystore 时，可显式传入 -Pairp.android.allowDebugReleaseSigning=true 使用 debug keystore
                signingConfig = signingConfigs.getByName("debug")
            }
            proguardFiles(
                *fileTree(".") { include("**/*.pro") }
                    .plus(getDefaultProguardFile("proguard-android-optimize.txt"))
                    .toList().toTypedArray()
            )
        }
    }
    kotlinOptions {
        jvmTarget = "1.8"
    }
    buildFeatures {
        buildConfig = true
    }
}

rust {
    rootDirRel = "../../../"
}

dependencies {
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.lifecycle:lifecycle-process:2.10.0")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.4")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.0")
}

apply(from = "tauri.build.gradle.kts")
