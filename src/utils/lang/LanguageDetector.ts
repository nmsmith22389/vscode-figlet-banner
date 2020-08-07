/* eslint-disable @typescript-eslint/no-empty-function */
import * as Code from 'vscode';
import { LanguageDetectorModule, Services, InitOptions } from 'i18next';

export default class LanguageDetector implements LanguageDetectorModule {
    static type = 'languageDetector' as const;

    type = LanguageDetector.type;

    constructor(
        services: Services,
        detectorOptions: Record<string, any>,
        i18nextOptions: InitOptions
    ) {
        this.init(services, detectorOptions, i18nextOptions);
    }

    init(
        _services: Services,
        _detectorOptions: Record<string, any>,
        _i18nextOptions: InitOptions
    ): void {}

    detect(): string | undefined {
        return Code.env.language;
    }

    cacheUserLanguage(_lng: string): void {}
}
