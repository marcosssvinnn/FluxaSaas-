#!/usr/bin/env python3
"""Aponta o build type "debug" do projeto Android gerado (via `cap add
android`) para um keystore de debug explícito e estável, em vez de depender
do comportamento implícito padrão do Android Gradle Plugin.

Por que isso existe: `android/app/build.gradle`, como o Capacitor gera, não
declara nenhum `signingConfigs` — só `buildTypes.release`. Sem uma config
explícita, o AGP usa seu próprio default pra assinar o build debug, que
(confirmado com diagnóstico real: hash do keystore restaurado do cache
idêntico antes/depois do `gradlew assembleDebug`, mas o .apk final saindo
assinado com uma chave DIFERENTE a cada run) não está resolvendo pro mesmo
caminho que a gente restaura do cache do GitHub Actions — resultado: cada
build assinava com uma chave nova, e o Android recusava instalar como
atualização de uma build anterior (pedia desinstalar toda vez).

Rodado pelo workflow build-android-apk.yml, com cwd = android/.
"""
import sys

KEYSTORE_PATH = "/home/runner/.android/debug.keystore"
GRADLE_FILE = "app/build.gradle"


def main():
    with open(GRADLE_FILE) as f:
        content = f.read()

    marker = "    buildTypes {\n"
    if marker not in content:
        sys.exit(
            f"buildTypes {{ não encontrado em {GRADLE_FILE} — o template do "
            "Capacitor mudou, revisar este script"
        )

    signing_block = (
        "    signingConfigs {\n"
        "        debug {\n"
        f"            storeFile file('{KEYSTORE_PATH}')\n"
        "            storePassword 'android'\n"
        "            keyAlias 'androiddebugkey'\n"
        "            keyPassword 'android'\n"
        "        }\n"
        "    }\n"
    )
    debug_build_type = (
        "        debug {\n"
        "            signingConfig signingConfigs.debug\n"
        "        }\n"
    )
    replacement = signing_block + marker + debug_build_type
    content = content.replace(marker, replacement, 1)

    with open(GRADLE_FILE, "w") as f:
        f.write(content)

    print(f"signingConfigs.debug aplicado em {GRADLE_FILE}, apontando pra {KEYSTORE_PATH}")


if __name__ == "__main__":
    main()
