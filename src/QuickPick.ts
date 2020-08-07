// TODO: Consider merging all the `chooseFont`s into a single method and use an Enum param to decide which fonts to select from.

import { TFunction } from 'i18next';
import * as Code from 'vscode';
import _find from 'lodash/find';
import FigletBanner, { Figlet } from '~/FigletBanner';
import Config, { DefinedSettings } from '~/Config';

export default class QuickPick {
    /**
     * The parent extension.
     */
    private extension: FigletBanner;

    private i18n: TFunction;

    private get config(): Config {
        return this.extension.config;
    }

    private get figlet(): Figlet {
        return this.extension.figlet;
    }

    constructor(extension: FigletBanner) {
        this.extension = extension;
        this.i18n = this.extension.i18n.getFixedT(null, 'quickPick');
    }

    private getItemLabel<T = string>(
        item: Thenable<Code.QuickPickItem | undefined>
    ): Promise<string | undefined> {
        return item.then(
            (i) => i?.label,
            () => undefined
        ) as Promise<string | undefined>;
    }

    public addDefaultItem(otherList?: Code.QuickPickItem[]): Code.QuickPickItem[] {
        const defaultItem: Code.QuickPickItem[] = [this.i18n('defaultValue')];

        if (otherList) {
            return defaultItem.concat(otherList);
        }

        return defaultItem;
    }

    public async chooseFont(
        options?: Code.QuickPickOptions,
        withDefault = false
    ): Promise<string | undefined> {
        const fonts = this.extension.allFonts;
        let items: Code.QuickPickItem[] = fonts.map((font) => {
            return {
                label: font,
                description: this.i18n('chooseFont.description', { font }),
            };
        });

        if (withDefault) {
            items = this.addDefaultItem(items);
        }

        return this.getItemLabel(Code.window.showQuickPick(items, options));
    }

    public async chooseFavorite(
        options?: Code.QuickPickOptions,
        withDefault = false
    ): Promise<string | undefined> {
        const favoriteFonts: string[] = this.config.settings.get('favorites') ?? [];

        if (favoriteFonts.length <= 0) {
            void Code.window.showQuickPick<Code.QuickPickItem>([this.i18n('noFavorites')]);

            return Promise.resolve(undefined);
        }

        let items: Code.QuickPickItem[] = favoriteFonts.map((font) => {
            return {
                label: font,
                description: this.i18n('chooseFont.description', { font }),
            };
        });

        if (withDefault) {
            items = this.addDefaultItem(items);
        }

        return this.getItemLabel(Code.window.showQuickPick(items, options));
    }

    public async chooseLayout(
        options?: Code.QuickPickOptions,
        withDefault = false
    ): Promise<string | undefined> {
        let items: Code.QuickPickItem[] = [
            { label: 'default', description: '' },
            { label: 'full', description: '' },
            { label: 'fitted', description: '' },
            { label: 'controlled smushing', description: '' },
            { label: 'universal smushing', description: '' },
        ];

        if (withDefault) {
            items = this.addDefaultItem(items);
        }

        return this.getItemLabel(Code.window.showQuickPick(items, options));
    }

    public async chooseCommentStyle(
        options?: Code.QuickPickOptions,
        withDefault = false
    ): Promise<string | undefined> {
        let items: Code.QuickPickItem[] = [
            { label: 'block', description: this.i18n('commentStyle.block.description') },
            { label: 'line', description: this.i18n('commentStyle.line.description') },
            { label: 'both', description: this.i18n('commentStyle.both.description') },
        ];

        if (withDefault) {
            items = this.addDefaultItem(items);
        }

        return this.getItemLabel(Code.window.showQuickPick(items, options));
    }

    public async chooseBoolean(
        options?: Code.QuickPickOptions,
        withDefault = false
    ): Promise<string | undefined> {
        let items: Code.QuickPickItem[] = [
            { label: 'True', description: '' },
            { label: 'False', description: '' },
        ];

        if (withDefault) {
            items = this.addDefaultItem(items);
        }

        return this.getItemLabel(Code.window.showQuickPick(items, options));
    }

    public chooseCustomFont(
        options?: Code.QuickPickOptions,
        withDefault = false
    ): Promise<string | undefined> {
        const customFonts = this.extension.customFonts;
        let items: Code.QuickPickItem[] = customFonts.map((font) => {
            return { label: font, description: '' };
        });

        if (withDefault) {
            items = this.addDefaultItem(items);
        }

        return this.getItemLabel(Code.window.showQuickPick(items, options));
    }

    public async generateNewConfig(): Promise<void> {
        const defaultConfig = this.config.getDefaultConfig();
        const configs = this.config.settings.get<DefinedSettings[]>('configs') ?? [];

        //> saveDefaults
        const saveDefaults = await this.chooseBoolean({
            placeHolder: this.i18n('saveDefaults.placeHolder'),
        }).then((v) => v === 'True');

        const withDefault = <T extends unknown>(
            value: string | undefined,
            defaultValue: T
        ): T | undefined => {
            const label = value?.trim();

            if (label === this.i18n('defaultValue.label')) {
                return saveDefaults ? defaultValue : undefined;
            }

            return (typeof defaultValue === 'boolean' ? label === 'True' : label) as T;
        };
        const withDefaultAffix = (value?: string, defaultValue?: string): string | undefined => {
            value = value?.trim();

            if (value === undefined || value === '') {
                return saveDefaults ? defaultValue : undefined;
            }

            return value === "''" ? '' : value;
        };

        //> name
        const name = await Code.window
            .showInputBox({ prompt: this.i18n('nameInput.prompt') })
            .then((n) => n?.trim());

        if (name === undefined || name.length <= 0) {
            void Code.window.showErrorMessage(this.i18n('error:noName'));
            return;
        }

        if (_find(configs, { name }) !== undefined) {
            void Code.window.showErrorMessage(this.i18n('error:configExists', { name }));
            return;
        }

        const config: DefinedSettings = { name };

        //> description
        const description = await Code.window.showInputBox({
            prompt: this.i18n('descriptionInput.prompt'),
        });
        config.description = description?.trim();

        //> font
        const font = await this.chooseFont({ placeHolder: 'font' }, true);

        config.font = withDefault(font, defaultConfig.figletConfig.font);

        //> horizontalLayout
        const horizontalLayout = await this.chooseLayout({ placeHolder: 'horizontalLayout' }, true);

        config.horizontalLayout = withDefault(
            horizontalLayout,
            defaultConfig.figletConfig.horizontalLayout
        );

        //> verticalLayout
        const verticalLayout = await this.chooseLayout({ placeHolder: 'verticalLayout' }, true);

        config.verticalLayout = withDefault(
            verticalLayout,
            defaultConfig.figletConfig.verticalLayout
        );

        //> trimTrailingWhitespace
        const trimTrailingWhitespace = await this.chooseBoolean(
            { placeHolder: 'trimTrailingWhitespace' },
            true
        );

        config.trimTrailingWhitespace = withDefault(
            trimTrailingWhitespace,
            defaultConfig.options.trimTrailingWhitespace
        );

        //> trimEmptyLines
        const trimEmptyLines = await this.chooseBoolean({ placeHolder: 'trimEmptyLines' }, true);

        config.trimEmptyLines = withDefault(trimEmptyLines, defaultConfig.options.trimEmptyLines);

        //> prefix
        const prefix = await Code.window.showInputBox({
            prompt: this.i18n('prefixInput.prompt'),
        });

        config.prefix = withDefaultAffix(prefix, defaultConfig.options.prefix);

        //> suffix
        const suffix = await Code.window.showInputBox({
            prompt: this.i18n('suffixInput.prompt'),
        });

        config.suffix = withDefaultAffix(suffix, defaultConfig.options.suffix);

        //> perLinePrefix
        const perLinePrefix = await Code.window.showInputBox({
            prompt: this.i18n('perLinePrefixInput.prompt'),
        });

        config.perLinePrefix = withDefaultAffix(perLinePrefix, defaultConfig.options.perLinePrefix);

        //> commentStyle
        const commentStyle = await this.chooseCommentStyle({ placeHolder: 'commentStyle' }, true);

        config.commentStyle = withDefault(commentStyle, defaultConfig.options.commentStyle);

        //> finish and save
        configs.push(config);

        void this.config.settings.update('configs', configs, true);
    }
}
