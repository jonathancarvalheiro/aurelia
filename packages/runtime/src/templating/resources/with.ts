import { inject } from '@aurelia/kernel';
import { BindingContext, IScope } from '../../binding/binding-context';
import { BindingFlags } from '../../binding/binding-flags';
import { IRenderLocation } from '../../dom';
import { ICustomAttribute, templateController } from '../custom-attribute';
import { IView, IViewFactory } from '../view';

export interface With extends ICustomAttribute {}
@templateController('with')
@inject(IViewFactory, IRenderLocation)
export class With {
  public value: any = null;

  private $child: IView = null;

  constructor(private factory: IViewFactory, location: IRenderLocation) {
    this.$child = this.factory.create();
    this.$child.$nodes.insertBefore(location);
  }

  public valueChanged(): void {
    this.bindChild(BindingFlags.callbackOrigin);
  }

  public bound(flags: BindingFlags): void {
    this.bindChild(flags);
  }

  public unbound(flags: BindingFlags): void {
    this.$child.$unbind(flags);
  }

  private bindChild(flags: BindingFlags): void {
    this.$child.$bind(flags, BindingContext.createScopeFromParent(this.$scope, this.value));
  }
}
