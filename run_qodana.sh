#!/bin/bash

add_prefix() {
    local input_str=$1
    local prefix=$2
    readarray -t input_array <<< "$input_str"
    result_str=""
    if (( ${#input_array[@]} < 2 )); then
        result_str+=" ${prefix} $input_str "
    else
        for v in "${input_array[@]}"; do
            if [ -n "$v" ]; then
                result_str+=" ${prefix} $v "
            fi
        done
    fi
    echo "$result_str"
}

mkdir -p "$RESULTS_DIR" "$CACHE_DIR"

gradle_settings_path=$(if [ -n "$GRADLE_SETTINGS_PATH" ]; then echo "-v $GRADLE_SETTINGS_PATH:/root/.gradle/gradle.properties"; else echo ""; fi)
idea_config_dir=$(if [ -n "$IDEA_CONFIG_DIR" ]; then echo "-v $IDEA_CONFIG_DIR:/root/.config/idea"; else echo ""; fi)

additional_volumes=$(if [ -n "$ADDITIONAL_VOLUMES" ]; then echo $(add_prefix "$ADDITIONAL_VOLUMES" "-v"); else echo ""; fi)
additional_env_variables=$(if [ -n "$ADDITIONAL_ENV_VARIABLES" ]; then echo $(add_prefix "$ADDITIONAL_ENV_VARIABLES" "--env"); else echo ""; fi)

case "$LINTER" in
"qodana-jvm-community")
    qodana_image='jetbrains/qodana-jvm-community:2021.2'
    ;;
"qodana-android")
    qodana_image='jetbrains/qodana-android:2021.2'
    ;;
*)
    echo "Unknown linter type: $LINTER"
    exit 1
    ;;
esac

docker run -u $UID -v "$PROJECT_DIR:/data/project" \
    -v "$RESULTS_DIR:/data/results" \
    -v "$CACHE_DIR:/data/cache" \
    $gradle_settings_path \
    $idea_config_dir \
    $additional_volumes \
    $additional_env_variables \
    $qodana_image \
    $(if [ -n "$INSPECTED_DIR" ]; then echo "-d $INSPECTED_DIR"; fi) \
    $(if [ -n "$BASELINE_PATH" ]; then echo "-b $BASELINE_PATH"; fi) \
    $(if [ "$BASELINE_INCLUDE_ABSENT" == "true" ]; then echo "--baseline-include-absent"; fi) \
    $(if [ -n "$FAIL_THRESHOLD" ]; then echo "--fail-threshold $FAIL_THRESHOLD"; fi) \
    $(if [ "$SAVE_HTML_REPORT" == "true" ]; then echo "--save-report"; fi) \
    $(if [ -n "$PROFILE_NAME" ]; then echo "-profileName $PROFILE_NAME"; fi) \
    $(if [ -n "$PROFILE_PATH" ]; then echo "-profilePath $PROFILE_PATH"; fi)
