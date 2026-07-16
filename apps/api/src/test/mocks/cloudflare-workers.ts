/** VitestではCloudflareランタイム固有モジュールを最小限のスタブに差し替える。 */
export class DurableObject {
  protected readonly ctx: DurableObjectState

  constructor(ctx: DurableObjectState, _env: unknown) {
    this.ctx = ctx
  }
}
