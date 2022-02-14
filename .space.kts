job("publish ci-common") {
    container(displayName = "Run publish script", image = "node:16-alpine") {
        env["REGISTRY"] = "https://packages.jetbrains.team/npm/p/sa/npm-public/"
        shellScript {
            content = """
                cd common
                npm install
                npm run build --if-present
                echo "registry = ${'$'}REGISTRY" >> ~/.npmrc
                AUTH=${'$'}(echo -ne "${'$'}JB_SPACE_CLIENT_ID:${'$'}JB_SPACE_CLIENT_SECRET" | base64 | tr -d \\n)
                echo "_auth = ${'$'}AUTH" >> ~/.npmrc
                echo "email = viktor@tiulp.in" >> ~/.npmrc
                echo "always-auth = true" >> ~/.npmrc
                npm run publish
            """
        }
    }
}