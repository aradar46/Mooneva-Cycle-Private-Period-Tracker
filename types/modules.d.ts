declare module 'html2pdf.js' {
    interface Html2Pdf {
        from(element: HTMLElement): Html2Pdf;
        set(options: any): Html2Pdf;
        save(): Promise<void>;
        output(type: string, options?: any): Promise<any>; // Add output method
        // Add other methods as needed
    }

    const html2pdf: () => Html2Pdf;
    export default html2pdf;
}
