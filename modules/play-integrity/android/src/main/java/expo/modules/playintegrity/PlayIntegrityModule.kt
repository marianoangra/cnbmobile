package expo.modules.playintegrity

import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.IntegrityTokenRequest
import com.google.android.play.core.integrity.IntegrityTokenResponse
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Wrapper Kotlin sobre Google Play Integrity API (Classic flow).
 *
 * Exposto como módulo PlayIntegrity no JS via Expo Modules autolink.
 * Único método: requestIntegrityToken(nonce, cloudProjectNumber) → JWE token (string).
 *
 * Usa a Classic API (IntegrityManagerFactory.create + requestIntegrityToken)
 * em vez da Standard (createStandard + prepareIntegrityToken/request) porque:
 *  - JUICE faz 1 request por sessao de carregamento (baixa frequencia)
 *  - Classic API e mais simples (uma chamada vs duas)
 *  - Standard otimiza warmup para apps de alta frequencia (chat, jogos)
 *
 * O nonce e server-issued (initSession Cloud Function). O cloudProjectNumber
 * e o numero do projeto Cloud linkado no Play Console (cnbmobile-2053c -> 144617374104).
 *
 * Erros possiveis:
 *  - NO_CONTEXT: applicationContext indisponivel (raro)
 *  - INTEGRITY_FAILED: Play Services rejeitou (device root, app nao reconhecido, etc)
 *  - INTEGRITY_EXCEPTION: excecao inesperada
 */
class PlayIntegrityModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("PlayIntegrity")

        AsyncFunction("requestIntegrityToken") { nonce: String, cloudProjectNumber: Double, promise: Promise ->
            val context = appContext.reactContext?.applicationContext
            if (context == null) {
                promise.reject("NO_CONTEXT", "Application context not available", null)
                return@AsyncFunction
            }

            try {
                val integrityManager = IntegrityManagerFactory.create(context)
                val request = IntegrityTokenRequest.builder()
                    .setNonce(nonce)
                    .setCloudProjectNumber(cloudProjectNumber.toLong())
                    .build()

                integrityManager.requestIntegrityToken(request)
                    .addOnSuccessListener { response: IntegrityTokenResponse ->
                        promise.resolve(response.token())
                    }
                    .addOnFailureListener { e: Exception ->
                        promise.reject(
                            "INTEGRITY_FAILED",
                            e.message ?: "requestIntegrityToken failed",
                            e
                        )
                    }
            } catch (e: Exception) {
                promise.reject("INTEGRITY_EXCEPTION", e.message ?: "Unknown error", e)
            }
        }
    }
}
