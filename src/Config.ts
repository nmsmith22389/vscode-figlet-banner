/* eslint-disable import/exports-last */
import * as fs from 'fs';
import * as path from 'path';
import * as Code from 'vscode';
import * as Figlet from 'figlet';
import FigletBanner from '~/FigletBanner';

export type CommentStyle = 'block' | 'line' | 'both';

export interface Settings {
    font?: string;
    horizontalLayout?: Figlet.KerningMethods;
    verticalLayout?: Figlet.KerningMethods;
    trimTrailingWhitespace?: boolean;
    trimEmptyLines?: boolean;
    prefix?: string;
    suffix?: string;
    perLinePrefix?: string;
    commentStyle?: CommentStyle;
    commentConfig?: Code.CommentRule;
    languageId?: string;
    configs?: DefinedSettings[];
}

export interface DefinedSettings extends Omit<Settings, 'configs' | 'commentConfig'> {
    name: string;
    description?: string;
}

export interface Configuration {
    figletConfig: {
        font: Settings['font'];
        horizontalLayout: Settings['horizontalLayout'];
        verticalLayout: Settings['verticalLayout'];
    };
    options: {
        trimTrailingWhitespace: Settings['trimTrailingWhitespace'];
        trimEmptyLines: Settings['trimEmptyLines'];
        prefix: Settings['prefix'];
        suffix: Settings['suffix'];
        perLinePrefix: Settings['perLinePrefix'];
        commentStyle: Settings['commentStyle'];
    };
    commentConfig?: Settings['commentConfig'];
}

interface LanguageContribConfig {
    id: string;
    extensions: string[];
    aliases: string[];
    filenames: string[];
    firstLine: string;
    configuration: string;
}

interface PackageJSON {
    contributes?: {
        languages?: LanguageContribConfig[];
    };
}

export default class Config {
    /**
     * The parent extension.
     */
    private extension: FigletBanner;

    constructor(extension: FigletBanner) {
        this.extension = extension;
    }

    public get settings(): Code.WorkspaceConfiguration {
        return Code.workspace.getConfiguration(
            this.extension.namespace,
            this.extension.activeTextEditor?.document
        );
    }

    /**
     * getDefault
     */
    public getDefaultConfig(withLanguage = false): Configuration {
        const settings = this.settings;

        const config: Configuration = {
            figletConfig: {
                font: settings.get('font'),
                horizontalLayout: settings.get('horizontalLayout'),
                verticalLayout: settings.get('verticalLayout'),
            },
            options: {
                trimTrailingWhitespace: settings.get('trimTrailingWhitespace'),
                trimEmptyLines: settings.get('trimEmptyLines'),
                prefix: settings.get('prefix'),
                suffix: settings.get('suffix'),
                perLinePrefix: settings.get('perLinePrefix'),
                commentStyle: settings.get('commentStyle'),
            },
        };

        if (withLanguage) {
            const language = this.extension.activeTextEditor?.document.languageId;

            config.commentConfig = this.getCommentConfig(language);
        }

        return config;
    }

    public getCommentConfig(languageId?: string): Code.CommentRule | undefined {
        const langConfig = this.getLanguageConfig(languageId);

        if (!langConfig) {
            console.warn('Figlet Banner: Language Config Not Found.');
        } else {
            if (Array.isArray(langConfig)) {
                for (const lang of langConfig) {
                    if (lang.comments) return lang.comments;
                }
            } else return langConfig.comments;
        }

        return undefined;
    }

    public getLanguageConfig(
        languageId?: string
    ): Code.LanguageConfiguration | Code.LanguageConfiguration[] | undefined {
        let langConfig: Code.LanguageConfiguration | undefined;
        const excludedLanguagesIds = ['plaintext'];

        if (languageId !== undefined && !excludedLanguagesIds.includes(languageId)) {
            let langConfigFilepath: string | undefined;
            const extsMatchingLang: string[] = [];

            for (const _ext of Code.extensions.all) {
                const packageJSON = _ext.packageJSON as PackageJSON;
                const languages = packageJSON.contributes?.languages;

                if (languages) {
                    const packageLangData = languages.find((lang) => lang.id === languageId);

                    if (packageLangData?.configuration) {
                        langConfigFilepath = path.join(
                            _ext.extensionPath,
                            packageLangData.configuration
                        );

                        extsMatchingLang.push(langConfigFilepath);
                    }
                }
            }

            //> if many definitions
            if (extsMatchingLang.length > 0) {
                const langConfigs: Code.LanguageConfiguration[] = [];
                for (const lang of extsMatchingLang) {
                    if (!!lang && fs.existsSync(lang)) {
                        langConfigs.push(JSON.parse(fs.readFileSync(lang, 'utf8')));
                    }
                }
                return langConfigs;
            }

            // FIXME: Switch to just returning an array. (like above)
            //> if only one definition
            if (!!langConfigFilepath && fs.existsSync(langConfigFilepath)) {
                /**
                 * unfortunatly, some of vscode's language config contains
                 * comments... ("xml" and "xsl" for example)
                 */
                langConfig = JSON.parse(
                    fs.readFileSync(langConfigFilepath, 'utf8')
                ) as Code.LanguageConfiguration;

                return langConfig;
            } else return undefined;
        }

        return undefined;
    }

    public formatConfigFromSettings(config: Settings): Configuration {
        return {
            figletConfig: {
                font: config.font ?? this.settings.get('font'),
                horizontalLayout: config.horizontalLayout ?? this.settings.get('horizontalLayout'),
                verticalLayout: config.verticalLayout ?? this.settings.get('verticalLayout'),
            },
            options: {
                trimTrailingWhitespace:
                    config.trimTrailingWhitespace ?? this.settings.get('trimTrailingWhitespace'),
                trimEmptyLines: config.trimEmptyLines ?? this.settings.get('trimEmptyLines'),
                prefix: config.prefix ?? this.settings.get('prefix'),
                suffix: config.suffix ?? this.settings.get('suffix'),
                perLinePrefix: config.perLinePrefix ?? this.settings.get('perLinePrefix'),
                commentStyle: config.commentStyle ?? this.settings.get('commentStyle'),
            },
            commentConfig: config.languageId ? this.getCommentConfig(config.languageId) : undefined,
        };
    }
}
