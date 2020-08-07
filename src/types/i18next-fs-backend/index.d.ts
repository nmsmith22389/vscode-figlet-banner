declare module 'i18next-fs-backend' {
    import * as I18next from 'i18next';

    namespace module {
        /**
         * Options for "i18next-node-fs-backend".
         */
        export interface Options {
            /**
             * Path where resources get loaded from, or a function returning a
             * path:
             *
             * ```js
             * function(lngs, namespaces) {
             *     return customPath;
             * }
             * ```
             *
             * The returned path will interpolate `lng`, `ns` if provided like
             * giving a static path.
             */
            loadPath?: string;

            /**
             * Path to post missing resources.
             */
            addPath?: string;

            /**
             * Indent to use when storing json files.
             */
            jsonIndent?: number;

            /**
             * Custom parser.
             */
            parse?: (data: any) => any;
        }

        /**
         * Options for `i18next`.
         */
        export interface I18nextOptions {
            backend?: Options;
        }
    }

    import Options = module.Options;

    class Backend implements I18next.BackendModule<Options> {
        type: 'backend';

        constructor(services?: any, options?: Options);

        init(
            services: I18next.Services,
            backendOptions?: Options,
            i18nextOptions?: I18next.InitOptions
        ): void;

        read(language: string, namespace: string, callback: I18next.ReadCallback): void;

        create(languages: string[], namespace: string, key: string, fallbackValue: string): void;
    }

    const module: typeof Backend;

    export = module;
}
