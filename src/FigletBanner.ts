// FIXME: Font paths in Info alerts don't display right. See below comment...
/*
Output:

Given file does not exist. Path: '&#x2F;Users&#x2F;neil&#x2F;Downloads&#x2F;figlet-fonts-master&#x2F;frango.flf
 */
// TODO: Find a way to have figlet take abs paths and not just its own: 'figlet/fonts/'
// TODO: Add try/catch to each settings update. (see `Commands.addCustomFont()`)

import * as path from 'path';
import i18next from 'i18next';
import * as fs from 'fs-extra';
import * as Code from 'vscode';
import * as Figlet from 'figlet';
import Backend from 'i18next-fs-backend';

import Debug from '~/Debug';
import Commands from '~/Commands';
import configLang from '~/utils/lang/Config';
import Config, { Configuration } from '~/Config';
import LanguageDetector from '~/utils/lang/LanguageDetector';

export type Figlet = typeof Figlet;

export default class FigletBanner {
    public namespace = 'figlet-banner';

    public context: Code.ExtensionContext;

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-expect-error
    public i18n: typeof i18next;

    public commands: Commands;

    public config: Config;

    public debug: Debug;

    public figlet = Figlet;

    public get activeTextEditor(): Code.TextEditor | undefined {
        return Code.window.activeTextEditor;
    }

    /**
     * The directory where custom fonts are stored.
     */
    public fontsDir?: string;

    public fontExts = ['.flf'];

    /**
     * Fonts added by the extension.
     *
     * Fonts in this list are already loaded.
     */
    public extensionFonts: string[] = [];

    /**
     * The names of custom fonts added by the user.
     *
     * Fonts in this list are already loaded.
     *
     * ---
     *
     * ## Note
     *
     * This is different than:
     *
     * ```typescript
     * this.config.settings.get('customFonts');
     * ```
     *
     * which returns a list of custom font paths from the user's settings.
     */
    public customFonts: string[] = [];

    /**
     * Get a list of all font names.
     *
     * This includes extension and custom fonts.
     */
    public get allFonts(): string[] {
        return this.getFigletFonts().concat(this.extensionFonts, this.customFonts).sort();
    }

    constructor(context: Code.ExtensionContext) {
        this.context = context;
        this.fontsDir = context.asAbsolutePath('./fonts');

        this.initI18n();

        this.commands = new Commands(this);
        this.config = new Config(this);
        this.debug = new Debug(this);

        this.activate();
    }

    private initI18n(): void {
        void i18next.use(LanguageDetector).use(Backend).init(configLang(this));

        this.i18n = i18next;
    }

    public activate(): void {
        this.debug.debug('Extension activated.');

        this.commands.register();

        this.loadExtensionFonts();
        void this.loadCustomFonts();

        //> Reload custom fonts if they are changed.
        const onDidChangeConfiguration = Code.workspace.onDidChangeConfiguration((e) => {
            const section = [this.namespace, 'customFonts'].join('.');
            const customFontsChanged = e.affectsConfiguration(
                section,
                this.activeTextEditor?.document
            );

            if (customFontsChanged) {
                this.debug.debug('Custom fonts setting changed.');

                // void Code.window.showInformationMessage(
                //     'Custom fonts changed.\n\nReloading custom fonts...'
                // );

                void this.loadCustomFonts();
            }
        }, this);

        this.context.subscriptions.push(onDidChangeConfiguration);
    }

    public async applyToEditor(config: Configuration): Promise<void> {
        const editor = this.activeTextEditor;

        const applied =
            (await editor?.edit((builder) => {
                editor.selections.forEach((selection) =>
                    this.applyToDocumentSelection(editor.document, builder, selection, config)
                );
            })) ?? false;

        if (!applied) {
            void Code.window.showErrorMessage(this.i18n.t('error:cantCreateBanner'));
        }
    }

    /**
     * Replace selection or line using config.
     */
    public applyToDocumentSelection(
        document: Code.TextDocument,
        builder: Code.TextEditorEdit,
        selection: Code.Selection,
        config: Configuration
    ): void {
        // let text: string;
        // let selectionIsLine: Code.TextLine | undefined;

        // if (selection.active.character === selection.anchor.character) {
        //     selectionIsLine = document.lineAt(selection.active);
        //     text = document.getText(selectionIsLine.range);
        // } else {
        //     text = document.getText(selection);
        // }

        const text = document.getText(selection);

        const bannerText = this.generateBannerComment(text, config);

        builder.replace(selection, bannerText ?? text);

        // if (selectionIsLine) {
        //     builder.delete(selectionIsLine.range);
        //     builder.insert(selectionIsLine.range.start, bannerText);
        // } else {
        //     builder.replace(selection, bannerText);
        // }
    }

    /**
     * Generate the banner text given the configs.
     */
    // FIXME: Rework this!
    public generateBannerComment(text: string, config: Configuration): string | undefined {
        let err: Error | undefined;
        let bannerText = '';
        const commentConfig = config.commentConfig;
        const options = config.options;

        try {
            let useBlockComment = false;
            let useLineComment = false;
            let linePrefix = '';

            if (commentConfig) {
                switch (options.commentStyle) {
                    case 'block': //? place blockComment around whole thing ONLY but if not block, use line
                        if (commentConfig.blockComment) useBlockComment = true;
                        else if (commentConfig.lineComment) useLineComment = true;
                        break;
                    case 'line': //? only use lineComment on each line but if no line, use block
                        if (commentConfig.lineComment) useLineComment = true;
                        else if (commentConfig.blockComment) useBlockComment = true;
                        break;
                    case 'both': //? place both styles
                        useBlockComment = !!commentConfig.blockComment;
                        useLineComment = !!commentConfig.lineComment;
                        break;
                }
            }

            if (useLineComment && commentConfig?.lineComment !== undefined) {
                linePrefix += commentConfig.lineComment;
            }

            linePrefix += options.perLinePrefix ?? '';

            // proccess now
            if (useBlockComment && commentConfig?.blockComment) {
                bannerText += commentConfig.blockComment[0] + '\n';
            }

            let figletText = '';

            figletText += (options.prefix ?? '') + '\n';
            figletText += this.figlet.textSync(text, config.figletConfig as Figlet.Options);
            figletText += '\n' + (options.suffix ?? '');

            for (let _line of figletText.split('\n')) {
                if (options.trimEmptyLines && _line.replace(/^\s*$/, '').length == 0) continue;

                if (options.trimTrailingWhitespace) _line = _line.replace(/\s*$/, '');

                bannerText += linePrefix + _line + '\n';
            }

            if (useBlockComment && commentConfig?.blockComment) {
                bannerText += commentConfig.blockComment[1];
            }
        } catch (replaceErr) {
            err = replaceErr as Error;
        }

        // NOTE: Had to move this outside of the `finally` block.
        if (err) {
            void Code.window.showErrorMessage(err.message);
        } else {
            return bannerText;
        }
    }

    /**
     * Return the font names from the provided paths.
     */
    public getFontNames(paths: string[]): string[] {
        return paths.map((file) => {
            const { name } = path.parse(file);

            return name;
        });
    }

    /**
     * Check if the provided font is loaded.
     */
    public fontExists(font: string): boolean {
        return this.allFonts.includes(font);
    }

    /**
     * Get the fonts that are part of Figlet.
     */
    public getFigletFonts(): string[] {
        return this.figlet.fontsSync();
    }

    /**
     * Get the paths of fonts that are added by the extension.
     */
    public getExtensionFonts(): string[] {
        if (this.fontsDir !== undefined && fs.existsSync(this.fontsDir)) {
            return fs
                .readdirSync(this.fontsDir)
                .map((file) => path.join(this.fontsDir as string, file));
        }

        return [];
    }

    /**
     * Get the paths of fonts that are added by the user.
     */
    public getCustomFonts(): string[] {
        return this.config.settings.get<string[]>('customFonts') ?? [];
    }

    /**
     * Loads fonts added by the extension.
     */
    public loadExtensionFonts(): void {
        this.debug.debug('Loading extension fonts...');

        const extensionFonts = this.getExtensionFonts();
        const added: string[] = [];

        for (let fontPath of extensionFonts) {
            fontPath = path.normalize(fontPath);
            const loaded = this.loadFont(fontPath);

            if (loaded) {
                added.push(fontPath);
            }
        }

        this.extensionFonts = this.getFontNames(added);
    }

    /**
     * Loads fonts added by the user.
     */
    public async loadCustomFonts(): Promise<void> {
        this.debug.debug('Loading custom fonts...');

        const customFonts = this.getCustomFonts();
        const paths: string[] = [];
        const added: string[] = [];
        const isFontFile = (p: string): boolean => this.fontExts.includes(path.extname(p));

        for (let fontPath of customFonts) {
            fontPath = path.normalize(fontPath);

            if (path.isAbsolute(fontPath)) {
                if (isFontFile(fontPath)) {
                    paths.push(fontPath);
                }

                continue;
            }

            // TODO: Add the glob feature to config description of setting.
            // TODO: Add support for non-glob dirs.
            const foundFiles = await Code.workspace.findFiles(fontPath, '**​/node_modules/**', 25);

            if (foundFiles.length <= 0) {
                void Code.window.showWarningMessage(
                    this.i18n.t('warning:globFontsNotFound', { glob: fontPath })
                );
                continue;
            }

            paths.push(...foundFiles.map((uri) => uri.fsPath).filter(isFontFile));
        }

        paths.forEach((fontPath) => {
            const loaded = this.loadFont(fontPath);

            if (loaded) {
                added.push(fontPath);
            }
        });

        this.customFonts = this.getFontNames(added);
    }

    /**
     * Check whether the provided font is loaded.
     */
    public isFontLoaded(font: string): boolean {
        return this.allFonts.includes(font);
    }

    /**
     * Loads a custom font.
     *
     * @returns `true` if the font is successfully loaded.
     */
    public loadFont(fontPath: string): boolean {
        if (!fs.pathExistsSync(fontPath)) {
            void Code.window.showErrorMessage(
                this.i18n.t('error:fileDoesNotExist', { file: fontPath })
            );
            return false;
        }

        try {
            const fontData = fs.readFileSync(fontPath, 'utf8');
            const { name: fontName } = path.parse(fontPath);

            this.debug.debug(`Read font data for '${fontName}'`, { fontData });

            this.figlet.parseFont(fontName, fontData);

            this.debug.debug(`Loaded font: '${fontName}'.`);

            return true;
        } catch (error) {
            this.debug.error(`Unable to load font: '${fontPath}'.`, error);

            // TODO: Maybe display error here. (Add a config setting to display font load error or not.)
            return false;
        }
    }
}
